import { z } from "zod";
import { db } from "../db/client.js";
import { sessions } from "../db/schema.js";
export const CreateSessionSchema = {
    slug: z.string().min(1)
        .describe("A unique identifier for the session. Must be non-empty and URL-safe. Used to reference the session in subsequent operations."),
    description: z.string().optional()
        .describe("Optional human-readable description explaining the session's purpose or contents."),
};
export async function createSession(data) {
    const now = new Date();
    const rows = await db.insert(sessions).values({
        slug: data.slug,
        description: data.description ?? null,
        createdAt: now,
        updatedAt: now,
    }).returning();
    return rows[0];
}
