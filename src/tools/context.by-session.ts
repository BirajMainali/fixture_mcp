import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { contexts } from "../db/schema.js";

export const ContextBySessionSchema = {
    sessionId: z.string()
        .describe("The session slug to retrieve context entries for. Returns all context entries scoped to this session."),
};

export async function contextBySession(data: z.infer<z.ZodObject<typeof ContextBySessionSchema>>) {
    return db.select().from(contexts).where(eq(contexts.sessionId, data.sessionId));
}
