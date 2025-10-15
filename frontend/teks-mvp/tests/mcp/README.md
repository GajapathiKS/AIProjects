# MCP Scenarios for TEKS MVP

This folder contains Model Context Protocol (MCP) YAML scenarios that mirror the passing Playwright E2E tests.

Each scenario:
- Logs in with admin credentials
- Seeds data via API (in-page `fetch` with a Bearer token) when needed
- Navigates to the target page and asserts headings/buttons
- Captures a screenshot for evidence

## Scenarios
- `students-overview.mcp.yaml` – Students heading, verifies "Add Student" is disabled.
- `students-journey.mcp.yaml` – Full student journey: open student, visit Assignments → Goals → Progress → Info.
- `goals-navigation.mcp.yaml` – Seed + navigate directly to Goals.
- `goals-create.mcp.yaml` – Seed + create a new Goal; verifies it appears.
- `student-assignments-overview.mcp.yaml` – Seed + assignments overview.
- `assignments-create.mcp.yaml` – Seed + create a new Assignment; verifies it appears.
- `student-needs-overview.mcp.yaml` – Seed + needs overview.
- `needs-create.mcp.yaml` – Seed + create a new Needs Assessment.
- `student-progress-overview.mcp.yaml` – Seed + progress overview.
- `progress-overview.mcp.yaml` – Seed + progress overview and New Progress control.

## Running (local)
These scripts run a minimal MCP client runner that launches the Playwright MCP stdio server, replays a YAML, and writes artifacts.

Environment variables (optional, for credentials):
- `PLAYWRIGHT_MCP_USERNAME` (default: `admin`)
- `PLAYWRIGHT_MCP_PASSWORD` (default: `ChangeMe123!`)
- `MCP_SECRETS_FILE` (path to a .env style file with `username=..` and `password=..` overrides)

From `frontend/teks-mvp`:

- `npm run mcp:run:students` – runs `tests/mcp/students-overview.mcp.yaml`
- `npm run mcp:run:students:journey` – runs the full students journey
- `npm run mcp:run:landing` – quick smoke of app shell (no auth)

Artifacts are written to `test-results/mcp/run-<timestamp>/`:
- `transcript.json` – step-by-step results
- `mcp.stderr.log` – server stderr (if any)
- `screenshots/` – captured screenshots

Note: If a scenario times out on a `waitFor`, the MCP runner will still save a failure screenshot and transcript. The E2E Playwright tests remain the source of truth while the MCP runner is being hardened.
