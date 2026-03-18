import { Router } from "express";
import { db } from "../db/db.js";
import { matches } from "../db/schema.js";
import { getMatchStatus } from "../utils/match-status.js";
import { createMatchSchema, listMatchesQuerySchema } from "../validation/matches.js";
import { desc } from "drizzle-orm";

export const matchRouter = Router();

const MAX_LIMIT = 100;

matchRouter.get("/", async (req, res) => {
    const parsed = listMatchesQuerySchema.safeParse(req.query);

    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid query.', details: parsed.error.issues });
    }

    const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);

    try {
        const data = await db
            .select()
            .from(matches)
            .orderBy((desc(matches.createdAt)))
            .limit(limit);


        res.json({ data });


    } catch (e) {
        console.error("Failed to fetch matches:", e);
        res.status(500).json({ error: 'Failed to fetch matches.' });
    }
});

matchRouter.post('/', async (req, res) => {
    const parsed = createMatchSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid payload.', details: parsed.error.issues });
    }

    const { data: { startTime, endTime, homeScore, awayScore } } = parsed;

    try {
        const [event] = await db.insert(matches).values({
            ...parsed.data,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            homeScore: homeScore ?? 0,
            awayScore: awayScore ?? 0,
            status: getMatchStatus(startTime, endTime),
        }).returning();

        res.status(201).json({ data: event });

        const broadcastMatchCreated = res.app.locals.broadcastMatchCreated;
        if (typeof broadcastMatchCreated === "function") {
            void Promise.resolve(broadcastMatchCreated(event)).catch((broadcastErr) => {
                console.error("broadcastMatchCreated error:", broadcastErr);
            });
        }
    } catch (e) {
        console.error("DB insert error:", e);
        res.status(500).json({ error: 'Failed to create match.', details: e.message });
    }
})

