# Playwright MCP Test Portal

Automation control plane for the TEKS MVP Playwright test suite. The portal lets you:

- catalogue environments (Dev/QA/Prod, staging, etc.) without embedding auth tokens in the portal
- onboard both traditional `.spec.ts` suites and human-readable MCP scenarios per feature/page
- trigger runs manually, via the built-in scheduler, or through the MCP client integrations
- inspect execution history, logs, JSON reports, traces, and screenshot evidence from the dedicated Runs page

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

The first run will create `data/portal.sqlite` and seed the schema automatically.

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

## Typical workflow (REST API)

Below are curl snippets that exercise the main flows while the API server is running.

1. **Create an environment** (configure base URL):
   ```bash
   curl -X POST http://localhost:4001/api/environments \
     -H 'Content-Type: application/json' \
     -d '{
       "name": "Local",
       "type": "web",
       "baseUrl": "http://localhost:4200"
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
       "playwrightMode": "traditional",
       "entryPoint": "frontend/teks-mvp/tests/e2e/students.spec.ts",
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
     - `screenshots/` – auto-captured evidence with run-aware filenames (includes MCP scenario captures).

Browse `http://localhost:4201/runs` in the UI to explore the full history, filters, and screenshot links.

## Configuring MCP client secrets

MCP scenarios often require API keys (e.g. ChatGPT or GitHub Copilot tokens) as well as credentials for the target application. The portal avoids storing secrets directly in the database—set them through environment variables or a dedicated secrets file instead:

1. **Create a secrets file** (dotenv format):
   ```bash
   mkdir -p ~/.config/playwright-mcp
   cat <<'ENV' > ~/.config/playwright-mcp/secrets.env
   OPENAI_API_KEY=sk-your-openai-key
   GITHUB_COPILOT_ACCESS_TOKEN=ghu_your_copilot_token
   PLAYWRIGHT_MCP_USERNAME=admin
   PLAYWRIGHT_MCP_PASSWORD=P@ssword1
   ENV
   ```

2. **Point the portal to the secrets** before starting the server:
   ```bash
   export MCP_SECRETS_FILE=~/.config/playwright-mcp/secrets.env
   npm run start:server
   ```

   The MCP client runner also respects `PLAYWRIGHT_MCP_USERNAME` and `PLAYWRIGHT_MCP_PASSWORD` environment variables if you prefer not to create a file. When absent, it falls back to the seeded API credentials (`admin / P@ssword1`).

3. **Grant the secrets to your MCP client** (ChatGPT, Copilot, Claude, etc.) following their documentation—each token stays outside of the portal database and is read only when invoking MCP scenarios.

## Dual onboarding (traditional + MCP)

The portal now distinguishes between traditional Playwright suites and MCP scenarios:

- **Traditional** – runs a `.spec.ts` entry point through `npx playwright test` inside `frontend/teks-mvp` (existing behaviour).
- **MCP** – reads a YAML scenario file, launches `@playwright/mcp`, and replays the defined actions via the new MCP client runner (`server/mcpClientRunner.js`). Screenshots, transcripts, and stderr logs are stored alongside traditional artifacts.

From the Scenarios page you can pick the mode, provide the appropriate entry path, and document the intent. Bulk onboarding supports both styles via `playwrightMode` and `mcpSource` fields.

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
rm -rf data/portal.sqlite data/artifacts
npm run start:server
```

This recreates the SQLite database and artifact folders on next launch.

## Troubleshooting

- **Playwright project not found:** ensure the `frontend/teks-mvp` directory exists relative to the repo root and contains the Playwright tests.
- **Missing browser binaries:** run `cd ../../frontend/teks-mvp && npx playwright install` to install the required browsers.
- **Authentication secrets:** configure them through `MCP_SECRETS_FILE`, `PLAYWRIGHT_MCP_USERNAME`, and `PLAYWRIGHT_MCP_PASSWORD` rather than embedding tokens in the database.

## Related resources

- `server/index.js` – REST API entry point.
- `server/mcpServer.js` – MCP stdio server exposing automation tools.
- `server/runManager.js` – queueing, scheduler, and Playwright invocation.
- `server/mcpClientRunner.js` – executes YAML scenarios via the Playwright MCP client.
- `server/storage.js` – SQLite schema + persistence helpers.

