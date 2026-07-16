#!/usr/bin/env node
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const sqlite = new Database(path.join(root, "fixture.db"));
const db = drizzle(sqlite);
migrate(db, { migrationsFolder: path.join(root, "drizzle") });

const now = Date.now();

sqlite.prepare(`INSERT OR IGNORE INTO sessions (id, slug, description, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?)`).run(1, "demo-api-flow", "Demo: user registration flow", now, now);

for (let i = 0; i < 3; i++) {
  sqlite.prepare(`INSERT OR IGNORE INTO events (id, session_slug, tool, input, output, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    `demo-evt-${i}`,
    "demo-api-flow",
    i === 0 ? "curl" : "workflow_step",
    JSON.stringify({
      method: i === 0 ? "POST" : "GET",
      url: `https://api.example.com/${i === 0 ? "login" : "profile"}`,
      headers: { "Content-Type": "application/json" },
      body: i === 0 ? '{"user":"demo"}' : undefined,
    }),
    JSON.stringify({
      status: i === 0 ? 200 : 201,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "demo-token-123", user: { id: 1, name: "Demo User" } }),
    }),
    i === 0 ? "Login to get access token" : "Fetch user profile",
    now - (2 - i) * 60000,
  );
}

const steps = [
  { id: "login", method: "POST", url: "https://api.example.com/login", headers: { "Content-Type": "application/json" }, body: '{"username":"${username}","password":"${password}"}', reason: "Authenticate user", extract: [{ var: "token", from: "response.body", path: "token" }], assert: [{ type: "status.equals", value: 200 }, { type: "body.exists", path: "token" }] },
  { id: "get-profile", method: "GET", url: "https://api.example.com/profile", headers: { "Content-Type": "application/json", Authorization: "Bearer ${token}" }, reason: "Fetch user profile", assert: [{ type: "status.equals", value: 200 }] },
  { id: "confirm-email", requiresInput: { prompt: "Enter the confirmation code sent to your email", captureVar: "code" } },
  { id: "verify", method: "POST", url: "https://api.example.com/verify", headers: { "Content-Type": "application/json" }, body: '{"code":"${code}","token":"${token}"}', reason: "Verify email with code", assert: [{ type: "status.equals", value: 200 }] },
];

sqlite.prepare(`INSERT OR IGNORE INTO workflows (id, slug, description, steps, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)`).run("demo-wf-1", "auth-flow", "Full authentication flow with email verification", JSON.stringify(steps), now, now);

console.log("Seed data inserted. Sessions: demo-api-flow, Workflows: auth-flow");
