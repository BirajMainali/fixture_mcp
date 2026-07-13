import { z } from "zod";
import { db } from "../db/client.js";
import { contexts } from "../db/schema.js";

export const CreateContextSchema = {
    scope: z.enum(["global", "session"])
        .describe("Whether this context is 'global' (applies to all requests) or 'session' (scoped to a specific session)."),
    sessionId: z.string().optional()
        .describe("Required only when scope is 'session'. The session slug this context belongs to."),
    field: z.string().min(1)
        .describe("The context field name. Use dot notation for nested values, e.g. 'auth.token' or 'headers.X-Custom'."),
    value: z.string().min(1)
        .describe("The value to store for this context field. Stored as a string; parse as needed on retrieval."),
    description: z.string().optional()
        .describe("Optional description of what this context value represents and when it should be injected."),
};

export async function createContext(data: z.infer<z.ZodObject<typeof CreateContextSchema>>) {
    const now = new Date();
    const rows = await db.insert(contexts).values({
        id: crypto.randomUUID(),
        scope: data.scope,
        sessionId: data.sessionId ?? null,
        field: data.field,
        value: data.value,
        description: data.description ?? null,
        createdAt: now,
        updatedAt: now,
    }).returning();
    return rows[0];
}
