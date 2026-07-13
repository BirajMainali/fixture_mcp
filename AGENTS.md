# Fixture — Agent Guide

MCP server for stateful API testing by AI agents. Persists sessions, context, events, and workflows in SQLite via Drizzle ORM.

## Commands

```sh
npm run build        # vitest run && tsc && chmod 755 build/index.js (tests run before compile)
npm test             # vitest run
npx vitest           # vitest (watch mode)
node build/index.js  # run (stdio MCP server; invoke via MCP host, not directly)
```

Tests live in `src/__tests__/*.test.ts` (6 files, 68 tests, 100% coverage across all source files). Mocking strategy: `vi.hoisted()` for module mocks, thenable `chainish` proxy for Drizzle query builder chains, `vi.stubGlobal('fetch')` for HTTP. `.gitignore` excludes `node_modules/`, `build/`, `.vscode/`, `fixture.db`.

## Architecture

- **Entrypoint**: `src/index.ts` — registers 15 MCP tools on `StdioServerTransport`.
- **Package bin name**: `fixture-mcp`. Set via `"bin": {"fixture-mcp": "./build/index.js"}` in `package.json`.
- **Database**: `fixture.db` created lazily by better-sqlite3 in `src/db/client.ts` (no migrations, no drizzle-kit config). Not in `.gitignore` — guard against committing it.
- **Schema** (`src/db/schema.ts`): 5 tables — `sessions`, `contexts`, `events`, `workflows`, `workflow_runs`.
- **IDs**: `crypto.randomUUID()` — requires Node 19+.
- **ESM**: All imports use `.js` extensions (Node16 moduleResolution). `"type": "module"` in package.json.
- **Drizzle**: `drizzle-kit` in devDependencies but **no drizzle.config.\* or migrations directory exists**. Schema is not pushed anywhere — agent must not assume a migration pipeline is in use.
- **No CI**: No `.github/` directory, no lint/format/test/typecheck pipeline.

## Tools

All tools in `src/tools/*.ts` use Zod schemas (plain object, not `z.object()`, for the older `schema`-style registration). Tool responses are `JSON.stringify(result, null, 2)` text content.

Key tools:
- `curl` — fetch + event logging, requires `session` slug
- `workflow_create` / `workflow_run` / `workflow_continue` — curated multi-step workflows with variable resolution (`${var}`), assertions, and manual input pause/resume
- `context_create` — supports `"global"` or `"session"` scope

## Conventions

- Session slugs are URL-safe string identifiers created by the AI, not auto-generated IDs.
- All HTTP requests go through the `curl` tool, which logs to the `events` table with a `reason` for traceability.
- Workflow steps use dot-path JSON traversal for variable extraction/assertion (e.g., `data.access_token`).

## Gotchas

- `fixture.db` is not gitignored — could be committed by accident.
- No dev server (`tsx` not installed). Must compile before testing changes.
- `drizzle-kit` is installed but unused; no migration setup exists.
