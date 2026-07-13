import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { contexts } from "../db/schema.js";

export const DeleteContextSchema = {
    id: z.string()
        .describe("The UUID of the context entry to delete, as returned by context_create or context_* list tools."),
};

export async function deleteContext(data: z.infer<z.ZodObject<typeof DeleteContextSchema>>) {
    const rows = await db.delete(contexts).where(eq(contexts.id, data.id)).returning();
    return rows[0] ?? null;
}
