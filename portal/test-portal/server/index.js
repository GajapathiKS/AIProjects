import express from 'express';
import {
  createEnvironment,
  createTestCase,
  deleteTestCase,
  getMetrics,
  getTestCaseRow,
  listEnvironments,
  listRuns,
  listTestCases,
  updateEnvironment,
  updateTestCase
} from './storage.js';
import { enqueueRun, scheduleEligibleRuns } from './runManager.js';

const app = express();
app.use(express.json());

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
  const run = enqueueRun(testCase, req.body?.triggeredBy ?? 'manual');
  res.status(202).json(run);
});

app.get('/api/test-runs', (req, res) => {
  const testCaseId = typeof req.query.testCaseId === 'string' ? Number(req.query.testCaseId) : undefined;
  const runs = listRuns({ testCaseId: Number.isNaN(testCaseId) ? undefined : testCaseId });
  res.json(runs);
});

app.get('/api/metrics', (_req, res) => {
  res.json(getMetrics());
});

setInterval(scheduleEligibleRuns, 60 * 1000);

const port = process.env.PORT ?? 4001;
app.listen(port, () => {
  console.log(`Playwright MCP Portal API listening on ${port}`);
});
