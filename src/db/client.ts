import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import { fileURLToPath } from "url"
import path from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, "../..")

const sqllite = new Database(path.join(projectRoot, "fixture.db"));

const db = drizzle(sqllite);

migrate(db, { migrationsFolder: path.join(projectRoot, "drizzle") });

export { db };