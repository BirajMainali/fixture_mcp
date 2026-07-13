import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"

const sqllite = new Database("fixture.db");

export const db = drizzle(sqllite);