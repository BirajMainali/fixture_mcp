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
const server = new McpServer({
    name: "fixture_mcp",
    version: "1.0.1",
    description: "Stateful API testing for AI agents. Execute HTTP requests with persistent session and global context.",
});
server.registerTool("curl", {
    description: "Execute an HTTP request with optional session context injection",
    inputSchema: CurlSchema,
}, async (args) => {
    const result = await curl(args);
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
});
server.registerTool("session_create", {
    description: "Create a new session",
    inputSchema: CreateSessionSchema,
}, async (args) => {
    const result = await createSession(args);
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
});
server.registerTool("session_list", {
    description: "List all sessions",
    inputSchema: {},
}, async () => {
    const result = await listSessions();
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
});
server.registerTool("session_edit", {
    description: "Edit a session",
    inputSchema: EditSessionSchema,
}, async (args) => {
    const result = await editSession(args);
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
});
server.registerTool("session_delete", {
    description: "Delete a session",
    inputSchema: DeleteSessionSchema,
}, async (args) => {
    const result = await deleteSession(args);
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
});
server.registerTool("context_create", {
    description: "Create a context entry (global or session-scoped)",
    inputSchema: CreateContextSchema,
}, async (args) => {
    const result = await createContext(args);
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
});
server.registerTool("context_edit", {
    description: "Edit a context entry",
    inputSchema: EditContextSchema,
}, async (args) => {
    const result = await editContext(args);
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
});
server.registerTool("context_delete", {
    description: "Delete a context entry",
    inputSchema: DeleteContextSchema,
}, async (args) => {
    const result = await deleteContext(args);
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
});
server.registerTool("context_global", {
    description: "Get all global-scoped contexts",
    inputSchema: {},
}, async () => {
    const result = await globalContexts();
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
});
server.registerTool("context_by_session", {
    description: "Get all contexts for a given session",
    inputSchema: ContextBySessionSchema,
}, async (args) => {
    const result = await contextBySession(args);
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
});
const transport = new StdioServerTransport();
await server.connect(transport);
