# Playwright MCP Test Portal

Automation control plane for the TEKS MVP Playwright test suite. The portal lets you:

- catalogue environments (Dev/QA/Prod, different auth strategies, etc.)
- onboard Playwright scenarios per feature/page with schedules and metadata
- trigger runs manually, via the built-in scheduler, or through the MCP server
- inspect execution history, logs, JSON reports, traces, and screenshot evidence

All persistence lives under `data/` (SQLite database and run artifacts).

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js 18+ | Required for the API, UI, and MCP server. |
| npm         | Used to install dependencies and run scripts. |
| Playwright deps | Ensure `frontend/teks-mvp` has run `npm install` and `npx playwright install` at least once. |

From the repo root, you should have the following structure:

```
frontend/teks-mvp      # Playwright project that contains the tests to execute
portal/test-portal     # This portal
```

## Install

```bash
cd portal/test-portal
npm install
```

The first run will create `data/app.db` and seed the schema automatically.

## Running the services

### 1. REST API (required)

```bash
npm run start:server
```

- Starts Express on `http://localhost:4001`.
- Handles environment + test case CRUD, run orchestration, metrics, and scheduling.
- Every minute the scheduler checks for test cases with `schedule !== 'manual'` and triggers them when due.

### 2. Web UI (optional)

```bash
npm run dev
```

- Vite dev server on `http://localhost:4201` (proxying API calls to `http://localhost:4001`).
- Provides forms to manage environments/test cases and to inspect run history and artifacts.

### 3. MCP Server (optional)

```bash
npm run start:mcp
```

- Exposes a Model Context Protocol server over stdio with tools for onboarding, scheduling, and running cases.
- Connect any MCP-compatible client (for example [Claude Desktop](https://www.anthropic.com/claude/desktop) or custom tooling) and point it at the command `node server/mcpServer.js`.
- Available tools: `list-environments`, `create-environment`, `update-environment`, `list-test-cases`, `create-test-case`, `update-test-case`, `delete-test-case`, `run-test-case`, `list-test-runs`.

> **Tip:** When testing locally you can open a second terminal and run `node server/mcpServer.js` directly. The server logs "Playwright MCP server is ready" to stderr once it is accepting connections.

### 4. Run both (REST + MCP)

```bash
npm run dev:all
```

- Starts both the REST API (port 4001) and the MCP stdio server.
- Prints when the REST API is ready; press Ctrl+C to stop both processes.
- Use this when you want to drive runs from an MCP client and also view them in the UI/REST.

## Typical workflow (REST API)

Below are curl snippets that exercise the main flows while the API server is running.

1. **Create an environment** (configure base URL + auth):
   ```bash
   curl -X POST http://localhost:4001/api/environments \
     -H 'Content-Type: application/json' \
     -d '{
       "name": "Local",
       "type": "web",
       "baseUrl": "http://localhost:4200",
       "authType": "token",
       "authToken": "${LOCAL_TOKEN}"
     }'
   ```

2. **Register a Playwright scenario** (feature/page onboarding):
   ```bash
   curl -X POST http://localhost:4001/api/test-cases \
     -H 'Content-Type: application/json' \
     -d '{
       "title": "Students smoke",
       "feature": "Students",
       "type": "playwright",
       "environmentId": 1,
       "entryPoint": "tests/e2e/students.spec.ts",
       "steps": ["login", "navigate", "assert"],
       "schedule": "manual",
       "captureArtifacts": true,
       "tags": ["smoke"]
     }'
   ```

3. **Trigger a run manually**:
   ```bash
   curl -X POST http://localhost:4001/api/test-cases/1/run \
     -H 'Content-Type: application/json' \
     -d '{ "triggeredBy": "manual" }'
   ```

4. **Check run status**:
   ```bash
   curl "http://localhost:4001/api/test-runs?testCaseId=1"
   ```

5. **Review artifacts**:
   - Each run gets a folder under `data/artifacts/run-<runId>/` containing:
     - `metadata.json` – original payload, environment, scheduling info, completion summary.
     - `stdout.log` / `stderr.log` – raw Playwright output.
     - `report.json` – parsed Playwright JSON reporter output.
     - `test-results/` – Playwright trace + attachments.
     - `screenshots/` – auto-captured evidence with run-aware filenames.

## Bulk onboarding from config

When you already know the environments and scenarios you want to register, apply them in one shot using the shared onboarding helper. The helper understands JSON payloads that look like [`onboarding.sample.json`](./onboarding.sample.json).

### CLI (recommended for local seeding)

```bash
# Preview the actions
npm run onboard -- --dry-run --file onboarding.sample.json

# Apply changes
npm run onboard -- --file onboarding.sample.json
```

### REST API

```bash
curl -X POST http://localhost:4001/api/onboarding \
  -H 'Content-Type: application/json' \
  -d '{
        "path": "onboarding.sample.json"
      }'
```

You can also send the entire JSON config inline instead of the `path` property. Include `"dryRun": true` in the body to see the diff without modifying the database.

### MCP server

From an MCP-aware client, call the `apply-onboarding-config` tool with either a JSON string or a file path:

```
{
  "tool": "apply-onboarding-config",
  "arguments": {
    "path": "onboarding.sample.json",
    "dryRun": false
  }
}
```

The response summarizes which environments and test cases were created, updated, skipped, and any validation errors encountered.

## Scheduling runs

Set the `schedule` field on a test case to `hourly` or `nightly` to let the portal enqueue runs automatically. The scheduler runs every minute and looks at `lastRunAt` timestamps to decide when to trigger the next execution.

You can still trigger the same case manually via API or MCP; the scheduler will pick up subsequent windows based on the most recent completion time.

## Resetting state

To wipe the portal and start clean:

```bash
rm -rf data/app.db data/artifacts
npm run start:server
```

This recreates the SQLite database and artifact folders on next launch.

## Troubleshooting

- **Playwright project not found:** ensure the `frontend/teks-mvp` directory exists relative to the repo root and contains the Playwright tests.
- **Missing browser binaries:** run `cd ../../frontend/teks-mvp && npx playwright install` to install the required browsers.
- **Authentication secrets:** use environment-specific tokens in the `authToken` field or extend the schema in `server/storage.js` to integrate with secret stores.

## Related resources

- `server/index.js` – REST API entry point.
- `server/mcpServer.js` – MCP stdio server exposing automation tools.
- `server/runManager.js` – queueing, scheduler, and Playwright invocation.
- `server/storage.js` – SQLite schema + persistence helpers.

## POC: MCP vs REST transports

To see the difference between starting only the MCP server, only the REST API, or both, run:

```powershell
# From portal/test-portal
pwsh -File scripts/poc-transport-diff.ps1 -Mode server-only   # Starts REST API, probes /api
pwsh -File scripts/poc-transport-diff.ps1 -Mode mcp-only      # Starts MCP stdio server, shows REST is unavailable
pwsh -File scripts/poc-transport-diff.ps1 -Mode both          # Starts both; runs via MCP will show in REST/UI
```

This script starts processes, waits briefly, probes `http://localhost:4001/api/test-cases`, prints a summary, and then cleans up the processes.

## POC: Trigger via MCP, observe via REST

To demonstrate end-to-end:

```bash
# Ensure dependencies are installed and Playwright project is set up
npm run dev:all   # optional: runs both servers; you can also let the demo start the API automatically

# Trigger a run via MCP by test case id
npm run mcp:run -- --id 4

# Or by title
npm run mcp:run -- --title "Goals page (simple)"
```

The script connects to the MCP stdio server, calls the `run-test-case` tool, then polls the REST API `/api/test-runs/:id` for completion and prints a short summary including the first few screenshot URLs.

