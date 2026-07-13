import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { contexts } from "../db/schema.js";
export async function globalContexts() {
    return db.select().from(contexts).where(eq(contexts.scope, "global"));
}
