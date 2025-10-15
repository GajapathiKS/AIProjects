import fs from 'node:fs';
import path from 'node:path';
import {
  artifactDir,
  createRunRecord,
  getEnvironmentRow,
  getTestCaseRow,
  listTestCaseRows,
  mapRun,
  updateRunRecord,
  updateTestCaseRunStatus
} from './storage.js';
import { runPlaywright } from './playwrightRunner.js';
import { runMcpScenario } from './mcpClientRunner.js';

function normalizeTestCase(input) {
  if (typeof input === 'number') {
    return getTestCaseRow(input);
  }
  if (input && typeof input === 'object') {
    if ('environment_id' in input) {
      return input;
    }
    if ('id' in input) {
      return getTestCaseRow(input.id);
    }
  }
  return null;
}

export function enqueueRun(testCase, triggeredBy = 'manual') {
  const row = normalizeTestCase(testCase);
  if (!row) {
    throw new Error('Test case not found');
  }

  const start = new Date().toISOString();
  const runId = createRunRecord(row.id, triggeredBy, start);

  updateTestCaseRunStatus(row.id, start, 'running');

  const runFolder = path.join(artifactDir, `run-${runId}`);
  fs.mkdirSync(runFolder, { recursive: true });

  const steps = Array.isArray(row.steps) ? row.steps : JSON.parse(row.steps);
  const metadata = {
    runId,
    triggeredBy,
    startedAt: start,
    environmentId: row.environment_id,
    entryPoint: row.entry_point,
    playwrightMode: row.playwright_mode ?? 'traditional',
    mcpSource: row.mcp_source ?? null,
    captureArtifacts: !!row.capture_artifacts,
    steps
  };

  const metadataPath = path.join(runFolder, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  function patchMetadata(patch) {
    try {
      const current = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      const next = { ...current, ...patch };
      fs.writeFileSync(metadataPath, JSON.stringify(next, null, 2));
    } catch (error) {
      console.warn(`Failed to update metadata for run ${runId}:`, error);
    }
  }

  (async () => {
    try {
      const env = getEnvironmentRow(metadata.environmentId);
      const mode = (row.playwright_mode ?? 'traditional').toLowerCase();
      let result;
      if (mode === 'mcp') {
        result = await runMcpScenario({
          runId,
          testCase: row,
          environment: env,
          artifactDir: runFolder
        });
      } else {
        result = await runPlaywright({
          runId,
          testCase: row,
          environment: env,
          artifactDir: runFolder
        });
      }
      const finish = new Date().toISOString();
      const artifactPath = path.relative(process.cwd(), path.join('data', 'artifacts', `run-${runId}`));
      const log = `Run ${runId} ${result.status}. ${result.summary}`;
      updateRunRecord(runId, {
        status: result.status,
        finishedAt: finish,
        log,
        artifactPath,
        screenshots: result.screenshots ?? []
      });
      updateTestCaseRunStatus(row.id, finish, result.status);
      patchMetadata({
        finishedAt: finish,
        status: result.status,
        summary: result.summary,
        report: result.jsonReportPath,
        screenshots: result.screenshots
      });
    } catch (error) {
      const finish = new Date().toISOString();
      const artifactPath = path.relative(process.cwd(), path.join('data', 'artifacts', `run-${runId}`));
      const log = `Run ${runId} failed to start: ${error?.message ?? error}`;
      updateRunRecord(runId, {
        status: 'failed',
        finishedAt: finish,
        log,
        artifactPath
      });
      updateTestCaseRunStatus(row.id, finish, 'failed');
      patchMetadata({
        finishedAt: finish,
        status: 'failed',
        error: error?.message ?? String(error)
      });
    }
  })();

  return mapRun({
    id: runId,
    test_case_id: row.id,
    status: 'running',
    triggered_by: triggeredBy,
    started_at: start,
    finished_at: null,
    log: null,
    artifact_path: null
  });
}

export function scheduleEligibleRuns() {
  const now = new Date();
  const cases = listTestCaseRows();
  cases.forEach(tc => {
    if (tc.schedule === 'manual') return;
    const lastRun = tc.last_run_at ? new Date(tc.last_run_at) : undefined;
    if (tc.schedule === 'hourly') {
      if (!lastRun || now.getTime() - lastRun.getTime() > 60 * 60 * 1000) {
        enqueueRun(tc, 'scheduler');
      }
    } else if (tc.schedule === 'nightly') {
      if (!lastRun || now.toDateString() !== lastRun.toDateString()) {
        enqueueRun(tc, 'scheduler');
      }
    }
  });
}
