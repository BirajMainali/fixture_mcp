#!/usr/bin/env node
import { createMcpServer } from "./create-mcp-server.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const args = process.argv.slice(2);
const isServe = args.includes("--serve") || !!process.env.FIXTURE_UI_PORT;

const stdioServer = createMcpServer();
const stdioTransport = new StdioServerTransport();
await stdioServer.connect(stdioTransport);

if (isServe) {
  const express = await import("express");
  const path = await import("path");
  const { fileURLToPath } = await import("url");
  const { StreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server/streamableHttp.js");
  const {
    getSessions, getSessionBySlug, getEvents,
    getWorkflows, getWorkflowBySlug,
    getRuns, getRun, getWorkflowRuns,
    getSessionCount, getEventCount, getWorkflowCount, getRunCount,
    getGlobalContextCount, getLocalContextCount, getLocalContexts,
  } = await import("./ui/queries.js");
  const { createSession } = await import("./tools/session.create.js");
  const { editSession } = await import("./tools/session.edit.js");
  const { deleteSession } = await import("./tools/session.delete.js");
  const { createContext } = await import("./tools/context.create.js");
  const { editContext } = await import("./tools/context.edit.js");
  const { deleteContext } = await import("./tools/context.delete.js");
  const { globalContexts } = await import("./tools/context.global.js");
  const { contextBySession } = await import("./tools/context.by-session.js");
  const { createWorkflow } = await import("./tools/workflow.create.js");
  const { runWorkflow } = await import("./tools/workflow.run.js");
  const { continueWorkflow } = await import("./tools/workflow.continue.js");

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const uiDir = path.resolve(__dirname, "../ui");

  const httpMcpServer = createMcpServer();

  const mcpTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  await httpMcpServer.connect(mcpTransport);

  const app = express.default();
  const PORT = parseInt(process.env.FIXTURE_UI_PORT ?? "4321", 10);

  app.use(express.default.json());

  app.all("/mcp", (req, res) => {
    mcpTransport.handleRequest(req, res, req.body);
  });

  app.use(express.default.static(uiDir));

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

  app.get("/", (_req, res) => {
    res.sendFile(path.join(uiDir, "index.html"));
  });

  app.listen(PORT, async () => {
    console.log(`Fixture UI → http://localhost:${PORT}`);
    console.log(`MCP endpoint → http://localhost:${PORT}/mcp`);
    const { exec } = await import("child_process");
    const url = `http://localhost:${PORT}`;
    const platform = process.platform;
    if (platform === "darwin") exec(`open ${url}`);
    else if (platform === "win32") exec(`start ${url}`);
    else exec(`xdg-open ${url}`);
  });
}
