# How to Use fixture-mcp
You have fixture-mcp installed. It is a tool for testing APIs with persistent memory. Think of it as a lab notebook for your HTTP requests: every call is logged, every value can be saved for later, and every multi-step sequence can be captured as a workflow and replayed whenever you need.
This guide walks you through everything you need to know. Read it once, then start using the tools.
## The Simple Flow (4 Steps)
Here is the basic pattern for any API test:
1. Create a session to hold your test.
2. Make HTTP calls through curl. Every call is logged.
3. Save returned values (tokens, IDs, etc.) to context so you can use them later.
4. Retrieve saved values before making calls that depend on them.
That is it for simple cases. For complex multi-step sequences, you can also define workflows (step 5 in this guide).
## Step 1: Create a Session
A session is a named container for your test. Think of it as a folder that holds all the HTTP calls, saved values, and events for one task.
```
session_create
  slug: "user-signup"
  description: "Test the full user registration flow"
```
Rules for the slug:
- Use only letters, numbers, and hyphens.
- Make it descriptive. "user-signup" is good. "test1" is not.
- You will use this slug in every curl call.
Do this before anything else. You cannot make HTTP calls without a session.
You can also list, edit, or delete sessions later using `session_list`, `session_edit`, and `session_delete`.
## Step 2: Make HTTP Calls with curl
curl is your only way to make HTTP requests. Every call is recorded as an event in the session log.
```
curl
  method: POST
  url: "https://api.example.com/auth/login"
  headers: { "Content-Type": "application/json" }
  body: "{\"username\":\"admin\",\"password\":\"secret\"}"
  session: "user-signup"
  reason: "Authenticating to obtain access token for subsequent API calls"
```
Parameters explained:
- `method`: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, or QUERY. Defaults to GET.
- `url`: The full URL including protocol. Required.
- `headers`: Optional key-value pairs for request headers.
- `body`: Optional request body. Do not use with GET or HEAD.
- `session`: The session slug from step 1. Required.
- `reason`: Why you are making this call. Optional, but strongly recommended.
The response you get back:
- `status`: HTTP status code as a number.
- `headers`: Response headers as an object.
- `body`: Response body as a string. Parse it as JSON if the server returned JSON.
On the reason field:
This is what makes your audit trail valuable. A future agent (or you, later) should be able to understand your thinking just from the reasons.
- Bad: "login"
- Good: "Fetching auth token because /user/profile needs Authorization header"
- Better: "Authenticating as admin user to obtain access token for subsequent API calls"
## Step 3: Save Values to Context
After curl returns a response, you will often need values from it later: auth tokens, user IDs, resource URLs, pagination cursors, and so on. Save them to context immediately.
```
context_create
  scope: "session"
  sessionId: "user-signup"
  field: "auth.access_token"
  value: "eyJhbGciOiJIUzI1NiIs..."
  description: "JWT access token returned from login endpoint"
```
Parameters explained:
- `scope`: Either `"session"` or `"global"`. See scope rules below.
- `sessionId`: Required when scope is `"session"`. The session slug.
- `field`: The name for this value. Use dot notation.
- `value`: The value itself, as a string.
- `description`: What this value represents.
When to save:
The moment curl returns a value you will need later, call context_create. Do not wait. Do not make another HTTP call first. If you wait, you might forget or lose the value.
What to save:
- Auth tokens, refresh tokens, session cookies
- User IDs, resource IDs, document IDs
- Resource URLs, upload URLs, redirect URLs
- Pagination cursors, page tokens
- CSRF tokens, nonces, one-time challenge values
- Base URLs, API keys, environment config
How to name fields (use dot notation):
```
auth.access_token
auth.refresh_token
user.id
user.email
resource.article.id
pagination.next_cursor
config.base_url
config.api_key
```
Scope rules explained:
- `"session"` scope: The value only matters for this one session. A login token for "user-signup" is meaningless for "payment-flow". Always use session scope unless you are sure the value should be visible everywhere.
- `"global"` scope: The value applies across all sessions. Use this for base URLs, API keys, environment names, shared test accounts. Global values are visible to every session.
Examples of both scopes:
Session-scoped (most common):
```
context_create
  scope: "session"
  sessionId: "user-signup"
  field: "auth.access_token"
  value: "eyJhbGci..."
  description: "JWT returned from login"
```
Global-scoped (shared config):
```
context_create
  scope: "global"
  field: "config.base_url"
  value: "https://api.example.com/v2"
  description: "Base URL for all API calls"
```
You can also update or delete context entries later using `context_edit` and `context_delete`.
## Step 4: Retrieve Context Before Dependent Calls
Before making a curl call that needs a saved value, look it up first. Do not assume you remember it.
```
context_by_session
  sessionId: "user-signup"
```
This returns all context entries for that session. Find the value you need and use it in your next request.
For global values:
```
context_global
```
This returns all global context entries.
## When Something Fails: Use the Event Log
If a test fails or a response looks wrong, do not guess what happened. Read the event log.
```
event_list
  session: "user-signup"
  tool: "curl"
```
This returns every curl call made in the session, in order, with:
- The full input you sent
- The full response you got back
- The timestamp
- The reason you provided
Read through it. You will see exactly what went wrong.
The `tool` parameter is optional. Use it to filter by tool name (e.g., `"curl"`).
## Step 5: Build Workflows (for Complex Sequences)
A workflow captures a multi-step sequence so you can replay it with one call. Here is the full process.
### When to Create a Workflow
Only after you have run the sequence manually with curl and verified it works. Never design a workflow from imagination. Run it by hand first, prove it works, then save it.
### How to Plan a Workflow
1. Run each step manually using curl. Note what the server returns at each step.
2. Identify which response values need to flow into later steps. Those become `extract` blocks.
3. Decide what validations you need on each response. Those become `assert` blocks.
4. Identify any steps that need human input. Those get a `requiresInput` block.
5. Save the workflow with `workflow_create`.
6. Replay it with `workflow_run` to confirm everything works.
### The workflow_create Command
```
workflow_create
  slug: "auth-flow"
  description: "Login, extract token, access profile"
  steps: [
    {
      id: "login",
      method: "POST",
      url: "https://api.example.com/auth/login",
      headers: { "Content-Type": "application/json" },
      body: "{\"username\":\"admin\",\"password\":\"secret\"}",
      reason: "Authenticate and get access token",
      extract: [
        { var: "access_token", from: "response.body", path: "data.access_token" }
      ],
      assert: [
        { type: "status.equals", value: 200 },
        { type: "body.exists", path: "data.access_token" }
      ]
    },
    {
      id: "get-profile",
      method: "GET",
      url: "https://api.example.com/user/profile",
      headers: { "Authorization": "Bearer ${access_token}" },
      reason: "Fetch profile using token from login step"
    },
    {
      id: "verify-email",
      method: "POST",
      url: "https://api.example.com/user/verify",
      headers: { "Authorization": "Bearer ${access_token}" },
      requiresInput: {
        prompt: "Enter the verification code sent to the user's email",
        captureVar: "verification_code"
      },
      body: "{\"code\":\"${verification_code}\"}"
    }
  ]
```
### Understanding Each Part of a Step
Step fields:
- `id`: A unique name for this step within the workflow. Use something descriptive like "login", "create-user", "fetch-profile".
- `method`: HTTP method. Same options as curl.
- `url`: The request URL. Can contain `${variable}` patterns.
- `headers`: Request headers. Can contain `${variable}` patterns.
- `body`: Request body. Can contain `${variable}` patterns.
- `reason`: Why this step exists.
- `extract`: Variables to pull from the response.
- `assert`: Validations to run on the response.
- `requiresInput`: If present, the workflow pauses here for human input.
Extract (pulling values from responses):
```
extract: [
  { var: "access_token", from: "response.body", path: "data.access_token" }
]
```
- `var`: The variable name. Use this in later steps as `${access_token}`.
- `from`: `"response.body"` or `"response.headers"`.
- `path`: Dot notation to reach the value. Examples:
  - `"data.access_token"` reads body.data.access_token
  - `"headers.content-type"` reads response.headers["content-type"]
  - `"data.items[0].id"` reads body.data.items[0].id (arrays supported)
Assert (validating responses):
```
assert: [
  { type: "status.equals", value: 200 },
  { type: "body.exists", path: "data.access_token" }
]
```
Here are all the assertion types:
| Type | Extra Fields | What It Checks |
|------|-------------|----------------|
| `status.equals` | `value` (number) | HTTP status equals this number exactly |
| `status.in` | `value` (array of numbers) | Status is one of the listed values |
| `status.range` | `value` [min, max] | Status is within this range (inclusive) |
| `body.exists` | `path` (string) | This dot-path exists in the response body |
| `body.equals` | `path` (string), `value` | Value at this path matches exactly |
| `body.contains` | `path` (string), `value` (string) | Value at this path contains this substring |
| `body.length` | `path` (string), `value` (number) | Array at this path has this exact length |
| `header.exists` | `path` (string) | This header key exists |
| `header.equals` | `path` (string), `value` (string) | Header value matches exactly |
| `header.contains` | `path` (string), `value` (string) | Header value contains this substring |
Important: Assertions log pass or fail but do NOT stop the workflow. A step with a failed assertion still counts as having run. Always check the results after the workflow completes.
requiresInput (pausing for human input):
```
requiresInput: {
  prompt: "Enter the verification code sent to the user's email",
  captureVar: "verification_code"
}
```
When the workflow reaches this step, it pauses and returns a continuationToken. You then call `workflow_continue` with the token and the human's answer.
Variable interpolation (how ${var} works):
When the workflow runs, it scans url, headers, and body for `${name}` patterns and replaces them with values from the variable map. The variable map is populated by:
1. `extract` blocks from earlier steps. If step 1 extracts `access_token`, then `${access_token}` in step 2 resolves to that value.
2. `requiresInput` blocks. When a human responds, their answer is stored under the `captureVar` name.
## Step 6: Run Workflows
```
workflow_run
  slug: "auth-flow"
```
The response tells you what happened:
Completed:
```
{
  "status": "completed",
  "results": [...],
  "session": "550e8400-e29b-41d4-a716-446655440000"
}
```
All steps ran. Check `results` to see which assertions passed and failed.
Paused (needs human input):
```
{
  "status": "paused",
  "continuationToken": "550e8400-e29b-41d4-a716-446655440000",
  "step": { "id": "verify-email", ... },
  "prompt": "Enter the verification code sent to the user's email",
  "resultsSoFar": [...]
}
```
The workflow is waiting for human input. Use the continuationToken with `workflow_continue`.
Error:
```
{
  "status": "error",
  "message": "Workflow slug 'auth-flow' not found"
}
```
Note: workflow_run creates its own session automatically. You do not provide one.
## Step 7: Resume Paused Workflows
When a workflow pauses for human input, resume it like this:
```
workflow_continue
  token: "550e8400-e29b-41d4-a716-446655440000"
  input: "123456"
```
- `token`: The continuationToken from the paused workflow_run response.
- `input`: The value the human provides.
## Quick Reference: All 15 Tools
| Tool | When to Use |
|------|-------------|
| `session_create` | Before any HTTP work. Creates a named session. |
| `session_list` | Find session IDs for editing or deleting. |
| `session_edit` | Change a session's slug or description. |
| `session_delete` | Remove a session and all its data. |
| `curl` | Make HTTP requests. The only way. Always include a reason. |
| `context_create` | Save a value for later use. Call immediately after curl. |
| `context_by_session` | Look up saved values for a session. |
| `context_global` | Look up global values. |
| `context_edit` | Update a saved context entry. |
| `context_delete` | Remove a context entry. |
| `event_list` | Debug or audit. Read the full request/response log. |
| `workflow_create` | Save a multi-step sequence as a reusable workflow. |
| `workflow_list` | View all saved workflow definitions. |
| `workflow_run` | Execute a workflow by slug. |
| `workflow_continue` | Resume a paused workflow with human input. |
## Hard Rules
1. Create a session before every curl call. No session, no request.
2. Write a specific reason on every curl call. Not "login". Write "Fetching auth token because /user/profile needs Authorization header".
3. Save context immediately. The moment a curl response gives you something useful, call context_create. Do not wait. Do not make another call first. Right now.
4. Use session scope for test data, global scope for config. Tokens and IDs are session-scoped. Base URLs and API keys are global.
5. Call event_list before debugging. Do not guess. Read the log.
6. Only create workflows after a successful manual run. Manual first, then automate. Never design a workflow from imagination.
7. Do not pass sessions to workflow_run. It creates its own session automatically.
8. Assertions never halt execution. Check results after the run to see what passed and failed.
9. Never make HTTP requests outside curl. They will not be logged and will break your audit trail.
10. Do not commit fixture.db. It is created automatically. Keep it out of version control.
