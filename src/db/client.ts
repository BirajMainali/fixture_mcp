import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"

const sqllite = new Database("fixture.db");

const db = drizzle(sqllite);

migrate(db, { migrationsFolder: "drizzle" });

export { db };