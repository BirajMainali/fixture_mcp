import { db } from "../db/client.js";
import { workflows } from "../db/schema.js";

export async function listWorkflows() {
    return db.select().from(workflows).orderBy(workflows.createdAt);
}
