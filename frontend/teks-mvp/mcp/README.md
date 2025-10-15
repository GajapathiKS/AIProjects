# Playwright MCP Scenarios

This folder hosts tooling and documentation for running human-readable Playwright scenarios through the MCP client runner.

## Key files

| File | Purpose |
| --- | --- |
| `schema/mcp-scenario.schema.json` | JSON Schema used to lint MCP YAML before execution. |
| `run-scenario.js` | CLI to execute a scenario with the MCP runner and collect artifacts. |
| `runner.js` | Core execution engine shared by the CLI and external callers. |
| `convert-spec.js` | Utility that generates a YAML skeleton from common Playwright `.spec.ts` patterns. |

## Scenario authoring guidelines

1. **Start with metadata**
   ```yaml
   name: Needs Assessment – create flow
   description: Creates a new needs assessment for a freshly seeded student.
   tags: [regression, needs]
   ```

2. **Configure runtime**
   ```yaml
   config:
     baseUrl: http://localhost:4200
     apiBaseUrl: http://localhost:5140
     timeout: 20000
     allowInsecureApiTls: true # sets NODE_TLS_REJECT_UNAUTHORIZED=0 for local dev certs
     servers:
       - name: api
         command: dotnet run --urls http://localhost:5140
         cwd: '{{ runtime.backendApiRoot }}'
         url: http://localhost:5140/swagger/index.html
         waitTimeout: 240000
         retryInterval: 2000
       - name: portal
         command: npx ng serve --port 4200 --host 0.0.0.0
         cwd: '{{ runtime.projectRoot }}'
         url: http://localhost:4200
         waitTimeout: 180000
   ```

3. **Prefer structured targets**
   ```yaml
   target:
     role: button
     name: "Sign in"
   ```

   Other accepted target shorthands:

   | Field | Meaning |
   | --- | --- |
   | `selector`/`css` | CSS selector. |
   | `testId` | Matches `data-testid` attributes. |
   | `role` + `name` | Accessible role lookup (with fuzzy text match by default). |
   | `text` | Searches for an element whose text contains the provided value. |

4. **Explicit waits** – Pair each navigation or asynchronous change with a `waitFor`, `expectVisible`, or `expectText` step. Avoid relying on implicit delays.

5. **Store context** – Use `set` steps to cache values for templating:
   ```yaml
   - set:
       stamp: "{{ runtime.runId }}"
   - fill:
       target:
         testId: need-title
       value: "Automation {{ vars.stamp }}"
   ```

6. **Back up with API calls** – `apiAuth` and `apiRequest` steps let you seed or clean up data directly against the .NET API while reusing portal secrets. Override `config.apiBaseUrl` (or pass `--env apiBaseUrl=...`) if your API runs on a different host/port.

7. **Path helpers** – Templates can access `runtime.projectRoot`, `runtime.repoRoot`, and `runtime.backendApiRoot` to build cross-platform paths for server commands.

8. **Artifacts** – Add `screenshot` steps where evidence matters; failures automatically capture a final screenshot.

## Running a scenario

```bash
node mcp/run-scenario.js --file tests/mcp/needs-create.mcp.yaml --start-server --artifacts test-results/mcp
```

Pass `--debug` to slow execution and print verbose step logs.

Use `--print-schema` to see the schema path, and `--dry-run` to lint YAML without launching a browser.

## Converting Playwright specs

`convert-spec.js` scans for common `page.goto`, `getByRole`, `getByTestId`, `fill`, `click`, and `expect` calls and emits an editable YAML stub. See the script for supported patterns.
