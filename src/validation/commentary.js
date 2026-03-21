import { z } from 'zod';

/**
 * Schema for listing commentary entries.
 * Includes an optional limit (coerced number, positive, max 100).
 */
export const listCommentaryQuerySchema = z.object({
    limit: z.coerce.number().positive().max(100).optional(),
});

/**
 * Schema for creating a new commentary entry.
 */
export const createCommentarySchema = z.object({
    minute: z.number().int().nonnegative(),
    sequence: z.number().int().nonnegative(),
    period: z.string(),
    eventType: z.string(),
    actor: z.string(),
    team: z.string(),
    message: z.string().min(1, 'Message is required'),
    metadata: z.record(z.any()),
    tags: z.array(z.string()),
});
