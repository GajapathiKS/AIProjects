# Playwright MCP Test Portal

This portal lets you manage environments and test cases, and run Playwright end‑to‑end tests for the teks‑mvp app. Runs are recorded with logs and JSON reports under `data/artifacts/`.

## Quick start

- Start the API server:
  - `npm run start:server`
- (Optional) Start the UI: `npm run dev`

## Create an environment

POST to `/api/environments`:

```
{
  "name": "Local",
  "type": "web",
  "baseUrl": "http://localhost:4200",
  "authType": "none"
}
```

## Register a test case

POST to `/api/test-cases`:

```
{
  "title": "Smoke",
  "type": "playwright",
  "environmentId": 1,
  "entryPoint": "tests/e2e/students.spec.ts",
  "steps": ["login", "navigate", "assert"]
}
```

## Run it

POST `/api/test-cases/:id/run` → returns a run id. Poll `/api/test-runs?testCaseId=:id` to see status.

Artifacts are saved under `data/artifacts/run-<id>/` with:
- stdout.log / stderr.log
- report.json (Playwright JSON reporter)
- metadata.json
- screenshots/ (auto-collected pass/fail evidence with run- and test-specific names)

## Configuration

- UI base URL is read from the Environment `baseUrl`.
- Backend API base for test seed utilities is read from `TEST_API_BASE` env var (defaults to `https://localhost:7140`).

## Notes

This invokes Playwright via `npx` in `frontend/teks-mvp`, using `playwright.config.ts`. Adjust as needed for other projects.# Playwright MCP Test Portal

Lightweight React + Express portal to orchestrate Playwright MCP Server scenarios against the TEKS MVP backend.

Key features:

- Environment catalogue with Dev/QA/Prod metadata, auth strategies, and operational notes.
- Test case authoring with UI/API/E2E classification, step inventories, scheduling (manual/hourly/nightly), and artifact capture flags.
- On-demand or scheduled Playwright MCP run simulation that persists run history, captures artifact metadata, and surfaces run telemetry on the dashboard.

## Running locally

```bash
cd portal/test-portal
npm install
npm run start:server # starts API on http://localhost:4001
npm run start:mcp    # starts the Playwright MCP server over stdio
npm run dev         # starts Vite dev server on http://localhost:4201
```

When `start:mcp` is executed the server exposes MCP tools for:

- Managing environments (`list-environments`, `create-environment`, `update-environment`).
- Authoring test cases (`list-test-cases`, `create-test-case`, `update-test-case`, `delete-test-case`).
- Triggering and inspecting executions (`run-test-case`, `list-test-runs`).

Environments capture target API URLs and credentials. Scenarios can be scheduled and triggered manually which simulates dispatching a Playwright MCP job. Both the REST API (`server/index.js`) and the MCP server share the same persistence utilities in `server/storage.js`/`server/runManager.js`, so runs triggered from either surface populate `data/artifacts/run-<id>/` with Playwright output.
