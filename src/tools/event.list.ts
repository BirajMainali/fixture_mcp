import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { events } from "../db/schema.js";

export const EventListSchema = {
    session: z.string()
        .describe("Session slug to fetch events for."),
    tool: z.string().optional()
        .describe("Optional filter by tool name (e.g., 'curl')."),
};

export async function eventList(data: z.infer<z.ZodObject<typeof EventListSchema>>) {
    const conditions = [eq(events.sessionSlug, data.session)];
    if (data.tool) {
        conditions.push(eq(events.tool, data.tool));
    }
    return db.select().from(events).where(and(...conditions)).orderBy(events.createdAt);
}
