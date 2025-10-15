# Test Portal Enhancement — Playwright MCP Server Integration

## Objective
Extend the existing Special Programs testing infrastructure to support AI-powered automation via Playwright MCP Server, ensuring scalability, configurability, and maintainability across all environments.

## Scope
Applies to the Special Programs .NET API and Angular application that currently execute Playwright-based automated tests against a SQL Server database.

## Enhancements to Implement

| # | Area | Description |
| --- | --- | --- |
| 1 | Playwright MCP Server Integration | Enable central management and execution of AI-assisted Playwright tests through MCP Server. |
| 2 | Feature/Page-Wise Onboarding | Allow test onboarding and configuration per feature, page, or module without requiring redeployments. |
| 3 | Auth Token Configuration | Make authentication tokens configurable per environment with secure storage and refresh logic. |
| 4 | Environment-Specific Setup | Support Dev, QA, Staging, and Production configurations with dynamic context switching. |
| 5 | Test Reports | Store and maintain execution logs, summaries, and statistics such as pass/fail rate, run duration, and coverage. |
| 6 | Scheduled Runs | Implement scheduled or trigger-based test execution windows. |
| 7 | Screenshot & Evidence Capture | Capture and version screenshots automatically for passed and failed validations. |
| 8 | Result Dashboard (Optional) | Provide a visual dashboard for result analytics and trend insights backed by centralized storage. |

## Expected Outcome
Deliver a unified Test Portal capable of running, managing, and monitoring Playwright MCP-driven automation across all configured environments.

## Current Implementation Snapshot

The `portal/test-portal` workspace already includes the first working slice of this architecture:

- **Run Orchestration** — `server/runManager.js` provides an in-memory queue and scheduler bridge so manual and cron-triggered executions share the same pipeline.
- **Persistence Layer** — `server/storage.js` wraps a SQLite data store (via `better-sqlite3`) that tracks environments, scenarios, run metadata, and artifact paths.
- **Playwright Execution** — `server/playwrightRunner.js` resolves environment context, injects configured auth headers, and captures rich result objects (with screenshot references) for each run.
- **Express API** — `server/index.js` exposes REST endpoints for onboarding environments/tests, requesting ad-hoc runs, and browsing run history.
- **Config-Driven Onboarding** — `server/onboarding.js` + CLI/API/MCP tooling apply JSON configs to bulk-create environments and Playwright scenarios.
- **MCP Server** — `server/mcpServer.js` registers the same operations as Model Context Protocol tools, enabling AI clients to list, create, update, delete, and execute portal entities over stdio.
- **Frontend Hooks** — The React/Vite shell (see `src` under `portal/test-portal`) consumes the REST layer to visualize onboarding state and run activity.

Use the README in `portal/test-portal` for step-by-step commands to install dependencies, start the REST service, or launch the MCP stdio server against this implementation.

### MCP YAML workflow quick start

- `frontend/teks-mvp/mcp/run-scenario.js` executes a YAML scenario locally. Run `node mcp/run-scenario.js --file tests/mcp/needs-create.mcp.yaml --start-server` from the Angular workspace to validate the dual-mode flows. The scenario now boots both the Angular dev server and the .NET API automatically when `--start-server` is supplied.
- `frontend/teks-mvp/mcp/schema/mcp-scenario.schema.json` defines the supported shape for YAML steps and powers runtime validation.
- `frontend/teks-mvp/mcp/README.md` documents best practices, including explicit waits, selector preferences, and how to seed data with `apiAuth`/`apiRequest`.
- `frontend/teks-mvp/mcp/convert-spec.js` generates a starter YAML outline from existing `.spec.ts` files to speed up authoring.

---

## Codex-Style System Prompt

**Prompt Title:** Extend Test Portal with Playwright MCP Server Integration

**Prompt:**
You are an expert full-stack automation architect. The existing system consists of:

- Backend: .NET API
- Frontend: Angular app
- Database: SQL Server
- Current Testing: Playwright (successfully integrated and executed)

Your task is to extend the Test Portal to include Playwright MCP Server capabilities and build a modular, scalable automation framework. Implement the following enhancements:

1. **Playwright MCP Server Integration** — Set up Playwright MCP Server to manage AI-assisted, environment-aware, and event-driven testing workflows.
2. **Feature/Page-Wise Onboarding** — Create dynamic onboarding for features or pages so new tests can be registered without code redeployments.
3. **Configurable Auth Tokens** — Implement environment-specific, token-based authentication with secure storage and refresh logic.
4. **Environment-Specific Onboarding** — Allow onboarding of different environments (Dev, QA, STG, PROD) using environment variables or configuration files.
5. **Test Reporting** — Generate and maintain structured test reports (pass/fail rate, logs, execution time, environment, author).
6. **Test Scheduling** — Introduce schedulers (cron-based or custom job triggers) for automated test runs.
7. **Screenshot & Evidence Capture** — Capture screenshots automatically for failed or passed tests; store them with timestamps and test metadata.
8. **Result Storage & Dashboard (Optional)** — Store results centrally (database or JSON store) and visualize metrics through a dashboard.

**Output:** Generate folder structure, sample configuration, and code snippets in Node.js (Playwright MCP) and link them with the existing Angular + .NET setup.
