import { db } from "../db/client.js";
import { events, sessions, workflows, workflowRuns, contexts } from "../db/schema.js";
import { eq, desc, count, and, asc } from "drizzle-orm";

export async function getSessions() {
  return db.select().from(sessions).orderBy(desc(sessions.createdAt));
}

export async function getSessionBySlug(slug: string) {
  const [row] = await db.select().from(sessions).where(eq(sessions.slug, slug)).limit(1);
  return row ?? null;
}

export async function getEvents(sessionSlug: string) {
  return db.select().from(events)
    .where(eq(events.sessionSlug, sessionSlug))
    .orderBy(asc(events.createdAt));
}

export async function getWorkflows() {
  return db.select().from(workflows).orderBy(desc(workflows.createdAt));
}

export async function getWorkflowBySlug(slug: string) {
  const [row] = await db.select().from(workflows).where(eq(workflows.slug, slug)).limit(1);
  return row ?? null;
}

export async function getRuns() {
  return db.select().from(workflowRuns).orderBy(desc(workflowRuns.createdAt));
}

export async function getRun(id: string) {
  const [row] = await db.select().from(workflowRuns).where(eq(workflowRuns.id, id)).limit(1);
  return row ?? null;
}

export async function getWorkflowRuns(workflowId: string) {
  return db.select().from(workflowRuns)
    .where(eq(workflowRuns.workflowId, workflowId))
    .orderBy(desc(workflowRuns.createdAt));
}

export async function getSessionCount() {
  const [row] = await db.select({ count: count() }).from(sessions);
  return row?.count ?? 0;
}

export async function getEventCount() {
  const [row] = await db.select({ count: count() }).from(events);
  return row?.count ?? 0;
}

export async function getWorkflowCount() {
  const [row] = await db.select({ count: count() }).from(workflows);
  return row?.count ?? 0;
}

export async function getRunCount() {
  const [row] = await db.select({ count: count() }).from(workflowRuns);
  return row?.count ?? 0;
}

export async function getGlobalContextCount() {
  const [row] = await db.select({ count: count() }).from(contexts).where(eq(contexts.scope, "global"));
  return row?.count ?? 0;
}

export async function getLocalContextCount() {
  const [row] = await db.select({ count: count() }).from(contexts).where(eq(contexts.scope, "session"));
  return row?.count ?? 0;
}

export async function getLocalContexts() {
  return db.select().from(contexts).where(eq(contexts.scope, "session")).orderBy(desc(contexts.createdAt));
}
