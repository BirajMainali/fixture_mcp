# fixture-mcp

MCP server for stateful API testing by AI agents.

## The problem

AI agents that test APIs make many HTTP requests. Without persistent state, every call is stateless. The agent must carry all context in its conversation window, which fills up fast and limits what it can do. There is no session concept, no audit trail, and no way to reuse a sequence of steps across runs.

## What this does

fixture-mcp is an MCP server for AI agents with persistent storage for API testing sessions, key-value context, event logs, and multi-step workflows. It always speaks MCP over stdio for AI agent integration, and can additionally start a web dashboard with an HTTP MCP endpoint.

The agent creates a session, makes HTTP requests, and stores responses as events. It can save extracted values into context (global or per-session) and reference them later. Workflows let the agent define a sequence of steps once and replay them, with variable interpolation, response extraction, assertions, and manual input prompts.

Data lives in a local SQLite file. No network, no cloud, no setup.

## Tools

### HTTP
- **curl**: Execute an HTTP request and log it as an event in a session. Requires a session slug and a reason for traceability. Returns status, headers, and body.

### Sessions
- **session_create**: Create a session with a URL-safe slug.
- **session_list**: List all sessions ordered by creation date.
- **session_edit**: Update a session slug or description.
- **session_delete**: Remove a session by numeric ID.

### Context (key-value store)
- **context_create**: Store a key-value pair with global or session scope.
- **context_edit**: Update a context entry's field, value, or description.
- **context_delete**: Remove a context entry by UUID.
- **context_global**: List all global-scoped context entries.
- **context_by_session**: List context entries for a given session.

### Events (audit log)
- **event_list**: List all events recorded for a session. Each event stores the request input, response output, timestamp, and reason. Optionally filter by tool name.

### Workflows
- **workflow_create**: Define a multi-step workflow with URL, method, headers, body, variable extraction, assertions, and manual input prompts.
- **workflow_list**: List all workflow definitions.
- **workflow_run**: Execute a workflow by slug. Each step runs through the curl tool. Variables from previous steps are resolved in `${var}` templates. If a step requires manual input, the run pauses and returns a continuation token.
- **workflow_continue**: Resume a paused workflow run with the requested input value.

## How it works

All data is stored in a local `fixture.db` file created automatically in the working directory (override path via `FIXTURE_DB_PATH` env var). The schema has five tables: sessions, contexts, events, workflows, and workflow_runs.

- Sessions are string slugs chosen by the agent, not auto-generated IDs. This lets the agent name sessions meaningfully (e.g. "user-registration").
- Context entries are key-value pairs scoped to a session or globally. They store extracted data like auth tokens or user IDs.
- Events record every curl request and response with a reason string, creating an audit trail the agent can review later.
- Workflows are JSON arrays of steps. Each step has a method, URL, optional headers/body, and optional extract/assert/requiresInput blocks. Variable templates use `${name}` syntax and are resolved from the per-run variable map, which is populated by extract blocks and user input.

Assertions run against the HTTP response. They do not stop execution on failure, but the step status reflects which assertions passed or failed. Types include status equals, range, or set membership; body existence, equality, containment, or array length; and header existence, equality, or containment.

## Web UI

fixture-mcp always serves MCP over stdio for AI agent integration. Pass `--serve` or set `FIXTURE_UI_PORT` to also start a web dashboard:

| Flag | Effect |
|------|--------|
| none | MCP over stdio only (AI agents) |
| `--serve` or `FIXTURE_UI_PORT` env | Adds Express server with UI at `http://localhost:4321` + MCP at `/mcp` |

Stdio MCP always runs, so your existing MCP host config keeps working. Serve mode just adds the HTTP server on top.

## Installation

```
npm install -g fixture-mcp
```

Requires Node 19 or later (uses `crypto.randomUUID()`).

## Usage

Run in stdio mode (default — for AI agents):

```
fixture-mcp
```

Configure it in your MCP host (Claude desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "fixture-mcp": {
      "command": "npx",
      "args": ["fixture-mcp"],
      "env": {
        "FIXTURE_DB_PATH": "/path/to/custom.db"
      }
    }
  }
}
```

Run in serve mode (web UI + HTTP MCP):

```
fixture-mcp --serve
# or
FIXTURE_UI_PORT=4321 fixture-mcp
```

For a streamable HTTP MCP host, configure the URL (not stdio):

```json
{
  "mcpServers": {
    "fixture-mcp": {
      "type": "url",
      "url": "http://localhost:4321/mcp"
    }
  }
}
```

The database file `fixture.db` is created in the working directory where the server runs. Override the path with the `FIXTURE_DB_PATH` environment variable:

```
FIXTURE_DB_PATH=/path/to/custom.db fixture-mcp
```

Each database is independent, so you can have separate databases for different projects or agents.

## How to instruct AI to use it effectively

See [`PROMPT.md`](./PROMPT.md). A self-contained prompt you can give to any AI agent. It covers when to use each tool, how to use them with examples, workflow details (interpolation, extraction, assertions, manual input), and rules/gotchas.

## Building from source

```
git clone https://github.com/BirajMainali/fixture_mcp.git
cd fixture_mcp
npm install
npm run build
node build/index.js
```

Tests:

```
npm test
```
