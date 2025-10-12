# Playwright MCP Test Portal

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
npm run dev         # starts Vite dev server on http://localhost:4201
```

Environments capture target API URLs and credentials. Scenarios can be scheduled and triggered manually which simulates dispatching a Playwright MCP job. Extend `server/index.js` to call your MCP Server endpoint when a scenario is triggered and populate the generated artifact folder (`data/artifacts/run-<id>`) with Playwright output.
