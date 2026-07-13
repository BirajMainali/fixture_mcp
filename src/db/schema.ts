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

export const events = sqliteTable("events", {
    id: text("id").primaryKey(),
    sessionSlug: text("session_slug").notNull(),
    tool: text("tool").notNull(),
    input: text("input").notNull(),
    output: text("output").notNull(),
    reason: text("reason"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const workflows = sqliteTable("workflows", {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    steps: text("steps").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const workflowRuns = sqliteTable("workflow_runs", {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id").notNull(),
    sessionSlug: text("session_slug").notNull(),
    currentStepIndex: integer("current_step_index").notNull().default(0),
    variables: text("variables").notNull().default("{}"),
    status: text("status", { enum: ["running", "paused", "completed", "failed"] }).notNull(),
    results: text("results").notNull().default("[]"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});