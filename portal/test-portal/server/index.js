import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import {
  createEnvironment,
  createTestCase,
  deleteTestCase,
  getMetrics,
  getRunRow,
  getTestCaseRow,
  listEnvironments,
  listRuns,
  listTestCases,
  mapRun,
  updateEnvironment,
  updateTestCase
} from './storage.js';
import { enqueueRun, scheduleEligibleRuns } from './runManager.js';
import { applyOnboardingConfig, loadOnboardingConfig } from './onboarding.js';

const app = express();
app.use(express.json());

// Serve run artifacts (stdout/stderr/report/screenshots) under /artifacts
app.use('/artifacts', express.static(path.join(process.cwd(), 'data', 'artifacts')));

app.get('/api/environments', (_req, res) => {
  res.json(listEnvironments());
});

app.post('/api/environments', (req, res) => {
  const env = createEnvironment(req.body);
  res.status(201).json(env);
});

app.put('/api/environments/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: 'Invalid environment id' });
  }
  const env = updateEnvironment(id, req.body);
  if (!env) {
    return res.sendStatus(404);
  }
  res.json(env);
});

app.get('/api/test-cases', (_req, res) => {
  res.json(listTestCases());
});

app.post('/api/test-cases', (req, res) => {
  const testCase = createTestCase(req.body);
  res.status(201).json(testCase);
});

app.put('/api/test-cases/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: 'Invalid test case id' });
  }
  const testCase = updateTestCase(id, req.body);
  if (!testCase) {
    return res.sendStatus(404);
  }
  res.json(testCase);
});

app.delete('/api/test-cases/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: 'Invalid test case id' });
  }
  const deleted = deleteTestCase(id);
  if (!deleted) {
    return res.sendStatus(404);
  }
  res.sendStatus(204);
});

app.post('/api/test-cases/:id/run', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: 'Invalid test case id' });
  }
  const testCase = getTestCaseRow(id);
  if (!testCase) {
    return res.sendStatus(404);
  }
  const triggeredBy = req.body?.triggeredBy ?? 'manual';
  const authToken = req.body?.authToken;
  const environmentOverrides = req.body?.environmentOverrides ?? {};
  const overrides = { ...environmentOverrides };
  if (typeof authToken === 'string' && authToken.length > 0) {
    overrides.authToken = authToken;
  }
  const run = enqueueRun(testCase, triggeredBy, overrides);
  res.status(202).json(run);
});

app.get('/api/test-runs', (req, res) => {
  const testCaseId = typeof req.query.testCaseId === 'string' ? Number(req.query.testCaseId) : undefined;
  const runs = listRuns({ testCaseId: Number.isNaN(testCaseId) ? undefined : testCaseId });
  res.json(runs);
});

// Run details including screenshots derived from metadata.json
app.get('/api/test-runs/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: 'Invalid run id' });
  }
  const row = getRunRow(id);
  if (!row) return res.sendStatus(404);
  const run = mapRun(row);
  const folder = path.join(process.cwd(), 'data', 'artifacts', `run-${id}`);
  const metadataPath = path.join(folder, 'metadata.json');
  let screenshots = [];
  try {
    if (fs.existsSync(metadataPath)) {
      const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      if (Array.isArray(meta.screenshots)) {
        screenshots = meta.screenshots.map(s => ({
          title: s.title ?? undefined,
          status: s.status ?? undefined,
          fileName: s.fileName ?? undefined,
          url: `/artifacts/run-${id}/${String(s.relativePath ?? s.fileName).replace(/\\/g, '/')}`
        }));
      }
    }
  } catch {}
  res.json({ ...run, screenshots });
});

app.get('/api/metrics', (_req, res) => {
  res.json(getMetrics());
});

app.post('/api/onboarding', (req, res) => {
  try {
    const { config: inlineConfig, path: configPath, dryRun } = req.body ?? {};
    let payloadInput = inlineConfig ?? configPath ?? null;

    if (!payloadInput) {
      const inline = {};
      if (req.body?.environments) inline.environments = req.body.environments;
      if (req.body?.testCases) inline.testCases = req.body.testCases;
      if (Object.keys(inline).length > 0) {
        payloadInput = inline;
      }
    }

    if (!payloadInput) {
      throw new Error('Provide a config object, JSON string, or path to apply onboarding.');
    }

    const config = loadOnboardingConfig(payloadInput);
    const result = applyOnboardingConfig(config, { dryRun: !!dryRun });
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error?.message ?? String(error) });
  }
});

setInterval(scheduleEligibleRuns, 60 * 1000);

const port = process.env.PORT ?? 4001;
app.listen(port, () => {
  console.log(`Playwright MCP Portal API listening on ${port}`);
});
