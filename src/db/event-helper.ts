import { db } from "./client.js";
import { events } from "./schema.js";

export async function emitEvent(data: {
    sessionSlug: string;
    tool: string;
    input: object;
    output: object;
    reason?: string;
}) {
    const now = new Date();
    await db.insert(events).values({
        id: crypto.randomUUID(),
        sessionSlug: data.sessionSlug,
        tool: data.tool,
        input: JSON.stringify(data.input),
        output: JSON.stringify(data.output),
        reason: data.reason ?? null,
        createdAt: now,
    });
}
