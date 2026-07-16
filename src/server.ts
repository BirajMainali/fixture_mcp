#!/usr/bin/env node
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { curl, CurlSchema } from "./tools/curl.js";
import { createSession, CreateSessionSchema } from "./tools/session.create.js";
import { listSessions } from "./tools/session.list.js";
import { editSession, EditSessionSchema } from "./tools/session.edit.js";
import { deleteSession, DeleteSessionSchema } from "./tools/session.delete.js";
import { createContext, CreateContextSchema } from "./tools/context.create.js";
import { editContext, EditContextSchema } from "./tools/context.edit.js";
import { deleteContext, DeleteContextSchema } from "./tools/context.delete.js";
import { globalContexts } from "./tools/context.global.js";
import { contextBySession, ContextBySessionSchema } from "./tools/context.by-session.js";
import { eventList, EventListSchema } from "./tools/event.list.js";
import { createWorkflow, CreateWorkflowSchema } from "./tools/workflow.create.js";
import { listWorkflows } from "./tools/workflow.list.js";
import { runWorkflow, RunWorkflowSchema } from "./tools/workflow.run.js";
import { continueWorkflow, ContinueWorkflowSchema } from "./tools/workflow.continue.js";
import {
  getSessions, getSessionBySlug, getEvents,
  getWorkflows, getWorkflowBySlug,
  getRuns, getRun, getWorkflowRuns,
  getSessionCount, getEventCount, getWorkflowCount, getRunCount,
  getGlobalContextCount, getLocalContextCount, getLocalContexts,
} from "./ui/queries.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uiDir = path.resolve(__dirname, "../ui");

// --- MCP Server ---

const mcpServer = new McpServer({
  name: "fixture_mcp",
  version: "1.0.1",
  description: "Stateful API testing for AI agents. Execute HTTP requests with persistent session and global context.",
});

mcpServer.registerTool(
  "curl",
  {
    description: "Execute an HTTP request and record an event in the session log.",
    inputSchema: CurlSchema,
  },
  async (args) => {
    const result = await curl(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

mcpServer.registerTool(
  "session_create",
  {
    description: "Create a new session",
    inputSchema: CreateSessionSchema,
  },
  async (args) => {
    const result = await createSession(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

mcpServer.registerTool(
  "session_list",
  {
    description: "List all sessions",
    inputSchema: {},
  },
  async () => {
    const result = await listSessions();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

mcpServer.registerTool(
  "session_edit",
  {
    description: "Edit a session",
    inputSchema: EditSessionSchema,
  },
  async (args) => {
    const result = await editSession(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

mcpServer.registerTool(
  "session_delete",
  {
    description: "Delete a session",
    inputSchema: DeleteSessionSchema,
  },
  async (args) => {
    const result = await deleteSession(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

mcpServer.registerTool(
  "context_create",
  {
    description: "Create a context entry (global or session-scoped)",
    inputSchema: CreateContextSchema,
  },
  async (args) => {
    const result = await createContext(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

mcpServer.registerTool(
  "context_edit",
  {
    description: "Edit a context entry",
    inputSchema: EditContextSchema,
  },
  async (args) => {
    const result = await editContext(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

mcpServer.registerTool(
  "context_delete",
  {
    description: "Delete a context entry",
    inputSchema: DeleteContextSchema,
  },
  async (args) => {
    const result = await deleteContext(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

mcpServer.registerTool(
  "context_global",
  {
    description: "Get all global-scoped contexts",
    inputSchema: {},
  },
  async () => {
    const result = await globalContexts();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

mcpServer.registerTool(
  "context_by_session",
  {
    description: "Get all contexts for a given session",
    inputSchema: ContextBySessionSchema,
  },
  async (args) => {
    const result = await contextBySession(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

mcpServer.registerTool(
  "event_list",
  {
    description: "List events recorded for a session.",
    inputSchema: EventListSchema,
  },
  async (args) => {
    const result = await eventList(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

mcpServer.registerTool(
  "workflow_create",
  {
    description: "Persist a curated workflow definition.",
    inputSchema: CreateWorkflowSchema,
  },
  async (args) => {
    const result = await createWorkflow(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

mcpServer.registerTool(
  "workflow_list",
  {
    description: "List all persisted curated workflows.",
    inputSchema: {},
  },
  async () => {
    const result = await listWorkflows();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

mcpServer.registerTool(
  "workflow_run",
  {
    description: "Execute a curated workflow.",
    inputSchema: RunWorkflowSchema,
  },
  async (args) => {
    const result = await runWorkflow(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

mcpServer.registerTool(
  "workflow_continue",
  {
    description: "Resume a paused workflow run.",
    inputSchema: ContinueWorkflowSchema,
  },
  async (args) => {
    const result = await continueWorkflow(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

// --- Streamable HTTP Transport ---

const mcpTransport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
});

await mcpServer.connect(mcpTransport);

// --- Express Setup ---

const app = express();
const PORT = parseInt(process.env.FIXTURE_UI_PORT ?? "4321", 10);

app.use(express.json());

// --- MCP endpoint ---

app.all("/mcp", (req, res) => {
  mcpTransport.handleRequest(req, res, req.body);
});

// --- Static files ---

app.use(express.static(uiDir));

// --- REST API ---

// Stats
app.get("/api/stats", async (_req, res) => {
  try {
    const [sessions, events, workflows, runs, globalContexts, localContexts] = await Promise.all([
      getSessionCount(), getEventCount(), getWorkflowCount(), getRunCount(),
      getGlobalContextCount(), getLocalContextCount(),
    ]);
    res.json({ sessions, events, workflows, runs, globalContexts, localContexts });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Sessions
app.get("/api/sessions", async (_req, res) => {
  try {
    const rows = await getSessions();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/api/sessions/:slug", async (req, res) => {
  try {
    const session = await getSessionBySlug(req.params.slug);
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/api/sessions/:slug/events", async (req, res) => {
  try {
    const rows = await getEvents(req.params.slug);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/api/sessions", async (req, res) => {
  try {
    const { slug, description } = req.body;
    if (!slug) return res.status(400).json({ error: "slug is required" });
    const session = await createSession({ slug, description });
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.patch("/api/sessions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid session id" });
    const session = await editSession({ id, ...req.body });
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.delete("/api/sessions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid session id" });
    const session = await deleteSession({ id });
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Context
app.get("/api/context/global", async (_req, res) => {
  try {
    const entries = await globalContexts();
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/api/context/local", async (_req, res) => {
  try {
    const entries = await getLocalContexts();
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
app.get("/api/context/session/:sessionId", async (req, res) => {
  try {
    const entries = await contextBySession({ sessionId: req.params.sessionId });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/api/context", async (req, res) => {
  try {
    const { scope, sessionId, field, value, description } = req.body;
    if (!scope || !field || value === undefined) {
      return res.status(400).json({ error: "scope, field, and value are required" });
    }
    const entry = await createContext({ scope, sessionId, field, value, description });
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.patch("/api/context/:id", async (req, res) => {
  try {
    const entry = await editContext({ id: req.params.id, ...req.body });
    if (!entry) return res.status(404).json({ error: "Context entry not found" });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.delete("/api/context/:id", async (req, res) => {
  try {
    const entry = await deleteContext({ id: req.params.id });
    if (!entry) return res.status(404).json({ error: "Context entry not found" });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Workflows
app.get("/api/workflows", async (_req, res) => {
  try {
    const rows = await getWorkflows();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/api/workflows/:slug", async (req, res) => {
  try {
    const workflow = await getWorkflowBySlug(req.params.slug);
    if (!workflow) return res.status(404).json({ error: "Workflow not found" });
    res.json(workflow);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/api/workflows", async (req, res) => {
  try {
    const { slug, description, steps } = req.body;
    if (!slug || !steps) return res.status(400).json({ error: "slug and steps are required" });
    const workflow = await createWorkflow({ slug, description, steps });
    res.status(201).json(workflow);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/api/workflows/:slug/run", async (req, res) => {
  try {
    const result = await runWorkflow({ slug: req.params.slug });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/api/workflows/continue", async (req, res) => {
  try {
    const { token, input } = req.body;
    if (!token || input === undefined) {
      return res.status(400).json({ error: "token and input are required" });
    }
    const result = await continueWorkflow({ token, input });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Workflow Runs
app.get("/api/runs", async (_req, res) => {
  try {
    const rows = await getRuns();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/api/runs/:id", async (req, res) => {
  try {
    const run = await getRun(req.params.id);
    if (!run) return res.status(404).json({ error: "Run not found" });
    res.json(run);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/api/workflows/:slug/runs", async (req, res) => {
  try {
    const workflow = await getWorkflowBySlug(req.params.slug);
    if (!workflow) return res.status(404).json({ error: "Workflow not found" });
    const rows = await getWorkflowRuns(workflow.id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// --- SPA fallback ---

app.get("/", (_req, res) => {
  res.sendFile(path.join(uiDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Fixture UI → http://localhost:${PORT}`);
  console.log(`MCP endpoint → http://localhost:${PORT}/mcp`);
});
