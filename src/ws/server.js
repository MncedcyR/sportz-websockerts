import { WebSocketServer, WebSocket } from 'ws';
import { wsArcjet } from '../arcjet.js';

const matchSubscribers = new Map();

function subscribe(matchId, socket) {
    if (!matchSubscribers.has(matchId)) {
        matchSubscribers.set(matchId, new Set());
    }
    matchSubscribers.get(matchId).add(socket);
}

function unsubscribe(matchId, socket) {
    const subscribers = matchSubscribers.get(matchId);
    if (!subscribers) return;
    subscribers.delete(socket);
    if (subscribers.size === 0) {
        matchSubscribers.delete(matchId);
    }
}

function cleanupSubscriptions(socket) {
    for (const [matchId, subscribers] of matchSubscribers.entries()) {
        if (subscribers.has(socket)) {
            unsubscribe(matchId, socket);
        }
    }
}

function broadcastToMatch(matchId, payload) {
    const subscribers = matchSubscribers.get(matchId);
    const count = subscribers ? subscribers.size : 0;
    console.log(`[WS] Broadcasting to match ${matchId}. Subscriber count: ${count}`);
    if (!subscribers || count === 0) return;

    const message = JSON.stringify(payload);
    for (const client of subscribers) {
        try {
            if (client.readyState !== WebSocket.OPEN) {
                unsubscribe(matchId, client);
                continue;
            }
            client.send(message);
        } catch (e) {
            console.error(`Error sending to client for match ${matchId}:`, e);
            unsubscribe(matchId, client);
        }
    }
}

function handleMessage(socket, data) {
    const rawData = data.toString();
    console.log(`[WS] Received message: ${rawData}`);
    let message;
    try {
        message = JSON.parse(rawData);
    } catch (e) {
        console.error('Error parsing message:', e);
        sendJson(socket, { type: 'error', message: 'Invalid JSON' });
        return;
    }

    // Handle diverse client payload formats (matchId vs matchID vs match_id)
    const matchIdRaw = message.matchId ?? message.matchID ?? message.match_id;
    const matchId = Number(matchIdRaw);

    if (message.type === 'subscribe' && !isNaN(matchId)) {
        console.log(`[WS] Client subscribing to match ${matchId}`);
        subscribe(matchId, socket);
        socket.subscriptions.add(matchId);
        sendJson(socket, { type: 'subscribed', matchId: matchId });
        return;
    }
    else if (message.type === 'unsubscribe' && !isNaN(matchId)) {
        console.log(`[WS] Client unsubscribing from match ${matchId}`);
        unsubscribe(matchId, socket);
        socket.subscriptions.delete(matchId);
        sendJson(socket, { type: 'unsubscribed', matchId: matchId });
        return;
    }
    else {
        console.warn('Unknown message type:', message.type);
    }
}


function sendJson(socket, payload) {
    if (socket.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify(payload));
}

function broadcastToAll(wss, payload) {
    for (const client of wss.clients) {
        if (client.readyState !== WebSocket.OPEN) continue;

        client.send(JSON.stringify(payload));
    }
}


export function attachSocketServer(server) {
    const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 1024 * 1024 });

    wss.on('connection', async (socket, req) => {
        const ip = req.socket.remoteAddress;
        console.log(`[WS] New connection from ${ip}`);
        if (wsArcjet) {
            try {
                const decision = await wsArcjet.protect(req);

                if (decision.isDenied()) {
                    const code = decision.reason.isRateLimit() ? 1013 : 1008;
                    const reason = decision.reason.isRateLimit() ? 'Rate limit exceeded.' : 'Access denied.';
                    console.warn(`[WS] Connection denied from ${ip}: ${reason}`);
                    socket.close(code, reason);
                    return;
                }

            } catch (e) {
                console.error("[WS] Connection error during protection:", e);
                socket.close(1011, 'Internal server error.');
                return;
            }
        }

        sendJson(socket, { type: 'welcome' });
        socket.subscriptions = new Set();
        socket.on('message', (data) => {
            handleMessage(socket, data);
        });

        socket.on('error', (e) => {
            console.error("[WS] Socket error:", e);
            socket.terminate();
        });

        socket.on('close', () => {
            cleanupSubscriptions(socket);
        });
    });

    function broadcastMatchCreated(match) {
        broadcastToAll(wss, { type: 'match_created', data: match });
    }

    function broadcastCommentary(matchId, commentaryData) {
        broadcastToMatch(matchId, { type: 'commentary', data: commentaryData });
    }

    return { broadcastMatchCreated, broadcastCommentary };
}