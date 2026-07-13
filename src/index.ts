import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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

const server = new McpServer({
    name: "fixture_mcp",
    version: "1.0.1",
    description: "Stateful API testing for AI agents. Execute HTTP requests with persistent session and global context.",
});

server.registerTool(
    "curl",
    {
        description: "Execute an HTTP request and record an event in the session log. Every request requires a session slug, and you should include a reason explaining why the request is being made.",
        inputSchema: CurlSchema,
    },
    async (args) => {
        const result = await curl(args);
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
    },
);

server.registerTool(
    "session_create",
    {
        description: "Create a new session",
        inputSchema: CreateSessionSchema,
    },
    async (args) => {
        const result = await createSession(args);
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
    },
);

server.registerTool(
    "session_list",
    {
        description: "List all sessions",
        inputSchema: {},
    },
    async () => {
        const result = await listSessions();
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
    },
);

server.registerTool(
    "session_edit",
    {
        description: "Edit a session",
        inputSchema: EditSessionSchema,
    },
    async (args) => {
        const result = await editSession(args);
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
    },
);

server.registerTool(
    "session_delete",
    {
        description: "Delete a session",
        inputSchema: DeleteSessionSchema,
    },
    async (args) => {
        const result = await deleteSession(args);
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
    },
);

server.registerTool(
    "context_create",
    {
        description: "Create a context entry (global or session-scoped)",
        inputSchema: CreateContextSchema,
    },
    async (args) => {
        const result = await createContext(args);
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
    },
);

server.registerTool(
    "context_edit",
    {
        description: "Edit a context entry",
        inputSchema: EditContextSchema,
    },
    async (args) => {
        const result = await editContext(args);
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
    },
);

server.registerTool(
    "context_delete",
    {
        description: "Delete a context entry",
        inputSchema: DeleteContextSchema,
    },
    async (args) => {
        const result = await deleteContext(args);
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
    },
);

server.registerTool(
    "context_global",
    {
        description: "Get all global-scoped contexts",
        inputSchema: {},
    },
    async () => {
        const result = await globalContexts();
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
    },
);

server.registerTool(
    "context_by_session",
    {
        description: "Get all contexts for a given session",
        inputSchema: ContextBySessionSchema,
    },
    async (args) => {
        const result = await contextBySession(args);
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
    },
);

server.registerTool(
    "event_list",
    {
        description: "List events recorded for a session. Events are created by curl calls and include input, output, timestamp, and the reason the request was made.",
        inputSchema: EventListSchema,
    },
    async (args) => {
        const result = await eventList(args);
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
    },
);

server.registerTool(
    "workflow_create",
    {
        description: "Persist a curated workflow definition. The AI should analyze session events to identify variable flows, then pass the curated steps here.",
        inputSchema: CreateWorkflowSchema,
    },
    async (args) => {
        const result = await createWorkflow(args);
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
    },
);

server.registerTool(
    "workflow_list",
    {
        description: "List all persisted curated workflows.",
        inputSchema: {},
    },
    async () => {
        const result = await listWorkflows();
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
    },
);

server.registerTool(
    "workflow_run",
    {
        description: "Execute a curated workflow. Resolves ${var} in step url/headers/body, extracts variables from responses, and pauses for manual input when a step requires it.",
        inputSchema: RunWorkflowSchema,
    },
    async (args) => {
        const result = await runWorkflow(args);
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
    },
);

server.registerTool(
    "workflow_continue",
    {
        description: "Resume a paused workflow run by providing the requested input value. Pass the continuationToken and the user's input.",
        inputSchema: ContinueWorkflowSchema,
    },
    async (args) => {
        const result = await continueWorkflow(args);
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
    },
);

const transport = new StdioServerTransport();
await server.connect(transport);
