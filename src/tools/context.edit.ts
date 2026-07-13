import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { contexts } from "../db/schema.js";

export const EditContextSchema = {
    id: z.string()
        .describe("The UUID of the context entry to edit, as returned by context_create or context_* list tools."),
    field: z.string().min(1).optional()
        .describe("Optional new field name for the context entry. Use dot notation for nested values."),
    value: z.string().min(1).optional()
        .describe("Optional new value for the context entry."),
    description: z.string().optional()
        .describe("Optional new description. Provide an empty string to clear the description."),
};

export async function editContext(data: z.infer<z.ZodObject<typeof EditContextSchema>>) {
    const { id, ...fields } = data;
    const rows = await db.update(contexts).set({
        ...fields,
        updatedAt: new Date(),
    }).where(eq(contexts.id, id)).returning();
    return rows[0] ?? null;
}
