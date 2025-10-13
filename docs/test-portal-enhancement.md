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
