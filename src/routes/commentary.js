import { Router } from "express";
import { db } from "../db/db.js";
import { commentary } from "../db/schema.js";
import { createCommentarySchema, listCommentaryQuerySchema } from "../validation/commentary.js";
import { matchIdParamSchema as matchParamSchema } from "../validation/matches.js";
import { desc, eq } from "drizzle-orm";

export const commentaryRouter = Router({ mergeParams: true });

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;

/**
 * GET /matches/:id/commentary
 * Returns a list of commentary entries for a specific match.
 */
commentaryRouter.get("/", async (req, res) => {
    // 1. Validate req.params using matchParamSchema and req.query using listCommentaryQuerySchema
    const paramsValidation = matchParamSchema.safeParse(req.params);
    if (!paramsValidation.success) {
        return res.status(400).json({
            error: "Invalid match ID",
            details: paramsValidation.error.issues,
        });
    }

    const queryValidation = listCommentaryQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
        return res.status(400).json({
            error: "Invalid query parameters",
            details: queryValidation.error.issues,
        });
    }

    const { id: matchId } = paramsValidation.data;
    const limit = Math.min(queryValidation.data.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    try {
        // 2. Fetch data from the "commentary" table where "matchId" equals the ID from params
        const results = await db
            .select()
            .from(commentary)
            .where(eq(commentary.matchId, matchId))
            // 3. Order the results by "createdAt" in descending order
            .orderBy(desc(commentary.createdAt))
            // 4. Apply a limit based on the parameter
            .limit(limit);

        return res.status(200).json({
            data: results,
        });
    } catch (error) {
        console.error("Error fetching commentary:", error);
        return res.status(500).json({
            error: "Internal server error",
            details: error.message,
        });
    }
});

/**
 * POST /matches/:id/commentary
 * Creates a new commentary entry for a specific match.
 */
commentaryRouter.post("/", async (req, res) => {
    // 1. Validate req.params using matchParamSchema
    const paramsValidation = matchParamSchema.safeParse(req.params);

    if (!paramsValidation.success) {
        return res.status(400).json({
            error: "Invalid match ID",
            details: paramsValidation.error.issues,
        });
    }

    // 2. Validate req.body using createCommentarySchema
    const bodyValidation = createCommentarySchema.safeParse(req.body);
    if (!bodyValidation.success) {
        return res.status(400).json({
            error: "Invalid commentary data",
            details: bodyValidation.error.issues,
        });
    }

    const { id: matchId } = paramsValidation.data;
    const commentaryData = bodyValidation.data;

    try {
        // 3. Insert the data into the commentary table
        const [result] = await db.insert(commentary).values({
            matchId,
            minute: commentaryData.minute, // Map 'minute' from schema to 'minute' in DB
            sequence: commentaryData.sequence,
            period: commentaryData.period,
            eventType: commentaryData.eventType,
            actor: commentaryData.actor,
            team: commentaryData.team,
            message: commentaryData.message,
            metadata: commentaryData.metadata,
            tags: commentaryData.tags,
        }).returning();

        if (req.app.locals.broadcastCommentary) {
            req.app.locals.broadcastCommentary(result.matchId, result);
        }

        // 4. Return the result
        return res.status(201).json({
            message: "Commentary created successfully",
            data: result,
        });
    } catch (error) {
        console.error("Error inserting commentary:", error);
        return res.status(500).json({
            error: "Internal server error",
            details: error.message,
        });
    }
});


