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
import { applyOnboardingConfig, loadOnboardingConfig } from './onboarding.js';

const app = express();
app.use(express.json({ limit: '2mb' }));

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalString(value) {
  const normalized = normalizeString(value);
  return normalized ? normalized : undefined;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const truthy = ['true', '1', 'yes', 'on'];
  return truthy.includes(String(value).toLowerCase());
}

function parseSchedule(value) {
  const normalized = normalizeString(value).toLowerCase();
  return ['manual', 'hourly', 'nightly'].includes(normalized) ? normalized : 'manual';
}

function parsePlaywrightMode(value) {
  const normalized = normalizeString(value).toLowerCase();
  return normalized === 'mcp' ? 'mcp' : 'traditional';
}

function parseStringArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(item => normalizeString(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map(part => part.trim())
      .filter(Boolean);
  }
  return [];
}

function parseSteps(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(item => normalizeString(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n/)
      .map(step => step.trim())
      .filter(Boolean);
  }
  return [];
}

function sanitizeEnvironmentPayload(body = {}) {
  const errors = [];
  const name = normalizeString(body.name);
  const type = normalizeString(body.type) || 'web';
  const baseUrl = normalizeString(body.baseUrl ?? body.base_url ?? body.url);
  const notes = normalizeOptionalString(body.notes ?? body.description);

  if (!name) {
    errors.push('Environment name is required.');
  }
  if (!baseUrl) {
    errors.push('Environment baseUrl is required.');
  }

  return {
    valid: errors.length === 0,
    errors,
    payload: { name, type, baseUrl, notes }
  };
}

function parseMcpConfig(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') {
    return raw;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`Unable to parse mcpConfig: ${error.message}`);
    }
  }
  return null;
}

function sanitizeTestCasePayload(body = {}) {
  const errors = [];
  const title = normalizeString(body.title);
  const description = normalizeOptionalString(body.description) ?? '';
  const feature = normalizeOptionalString(body.feature) ?? '';
  const type = normalizeString(body.type) || 'playwright';
  const playwrightMode = parsePlaywrightMode(body.playwrightMode ?? body.playwright_mode);
  const environmentId = Number(body.environmentId ?? body.environment_id);
  const entryPointRaw = normalizeString(body.entryPoint ?? body.entry_point ?? body.mcpSource ?? body.mcp_source);
  const mcpSourceRaw = normalizeOptionalString(body.mcpSource ?? body.mcp_source);
  let mcpConfig = null;

  try {
    mcpConfig = parseMcpConfig(body.mcpConfig ?? body.mcp_config ?? body.config);
  } catch (error) {
    errors.push(error.message);
  }

  if (!title) {
    errors.push('Test case title is required.');
  }
  if (!Number.isFinite(environmentId)) {
    errors.push('Valid environmentId is required.');
  }

  const entryPoint = entryPointRaw;
  const mcpSource = playwrightMode === 'mcp' ? (mcpSourceRaw || entryPointRaw) : mcpSourceRaw || undefined;

  if (!entryPoint) {
    errors.push('Test case entryPoint is required.');
  }
  if (playwrightMode === 'mcp' && !mcpSource) {
    errors.push('MCP scenarios require an mcpSource path.');
  }

  const steps = parseSteps(body.steps);
  const schedule = parseSchedule(body.schedule);
  const captureArtifacts = parseBoolean(body.captureArtifacts ?? body.capture_artifacts, true);
  const tags = parseStringArray(body.tags);

  return {
    valid: errors.length === 0,
    errors,
    payload: {
      title,
      description,
      feature,
      type,
      playwrightMode,
      environmentId,
      entryPoint,
      mcpSource,
      mcpConfig,
      steps,
      schedule,
      captureArtifacts,
      tags
    }
  };
}

app.get('/api/environments', (_req, res) => {
  res.json(listEnvironments());
});

app.post('/api/environments', (req, res) => {
  const { valid, errors, payload } = sanitizeEnvironmentPayload(req.body);
  if (!valid) {
    return res.status(400).json({ message: errors.join(' ') });
  }
  const env = createEnvironment(payload);
  res.status(201).json(env);
});

app.put('/api/environments/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: 'Invalid environment id' });
  }
  const { valid, errors, payload } = sanitizeEnvironmentPayload(req.body);
  if (!valid) {
    return res.status(400).json({ message: errors.join(' ') });
  }
  const env = updateEnvironment(id, payload);
  if (!env) {
    return res.sendStatus(404);
  }
  res.json(env);
});

app.get('/api/test-cases', (_req, res) => {
  res.json(listTestCases());
});

app.post('/api/test-cases', (req, res) => {
  const { valid, errors, payload } = sanitizeTestCasePayload(req.body);
  if (!valid) {
    return res.status(400).json({ message: errors.join(' ') });
  }
  try {
    const testCase = createTestCase(payload);
    res.status(201).json(testCase);
  } catch (error) {
    res.status(400).json({ message: error?.message ?? String(error) });
  }
});

app.put('/api/test-cases/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: 'Invalid test case id' });
  }
  const { valid, errors, payload } = sanitizeTestCasePayload(req.body);
  if (!valid) {
    return res.status(400).json({ message: errors.join(' ') });
  }
  const testCase = updateTestCase(id, payload);
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
