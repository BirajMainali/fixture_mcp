import { db } from "../db/client.js";
import { sessions } from "../db/schema.js";

export async function listSessions() {
    return db.select().from(sessions).orderBy(sessions.createdAt);
}
