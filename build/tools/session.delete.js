import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { sessions } from "../db/schema.js";
export const DeleteSessionSchema = {
    id: z.number()
        .describe("The numeric ID of the session to delete, as returned by session_create or session_list."),
};
export async function deleteSession(data) {
    const rows = await db.delete(sessions).where(eq(sessions.id, data.id)).returning();
    return rows[0] ?? null;
}
