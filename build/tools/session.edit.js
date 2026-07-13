import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { sessions } from "../db/schema.js";
export const EditSessionSchema = {
    id: z.number()
        .describe("The numeric ID of the session to edit, as returned by session_create or session_list."),
    slug: z.string().min(1).optional()
        .describe("Optional new slug for the session. Must be non-empty if provided."),
    description: z.string().optional()
        .describe("Optional new description for the session. Provide an empty string to clear the description."),
};
export async function editSession(data) {
    const { id, ...fields } = data;
    const rows = await db.update(sessions).set({
        ...fields,
        updatedAt: new Date(),
    }).where(eq(sessions.id, id)).returning();
    return rows[0] ?? null;
}
