import express from 'express';
import http from 'http';
import { matchRouter } from './routes/matches.js';
import { attachSocketServer } from './ws/server.js';
import { securityMiddleware } from './arcjet.js';

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || '0.0.0.0';



// Middleware to parse JSON bodies  
const app = express();
const server = http.createServer(app);
app.use(express.json());



// Root GET route
app.get('/', (req, res) => {
    res.send('Welcome to the Sportz Express Server!');
});


app.use(securityMiddleware());

app.use("/matches", matchRouter);

const { broadcastMatchCreated } = attachSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;

// Global error handler — catches malformed JSON from body-parser
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'Invalid JSON payload.', details: err.message });
    }
    next(err);
});

// Start the server
server.listen(PORT, HOST, () => {
    const baseUrl = HOST === '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
    console.log(`Server is running ON  ${baseUrl}`);
    console.log(`WebSocket server is running ON ${baseUrl.replace('http', 'ws')}/ws`);
});
