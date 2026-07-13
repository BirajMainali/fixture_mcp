import {
    sqliteTable,
    text,
    integer,
} from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
    id: integer("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export const contexts = sqliteTable("contexts", {

    id: text("id").primaryKey(),
    scope: text("scope", {
        enum: ["global", "session"],
    }).notNull(),

    sessionId: text("session_id"),
    field: text("field").notNull(),
    value: text("value").notNull(),
    description: text("description"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});