import fs from 'node:fs';
import path from 'node:path';
import {
  createEnvironment,
  createTestCase,
  listEnvironments,
  listTestCases,
  updateEnvironment,
  updateTestCase
} from './storage.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveConfigPath(spec) {
  const cwd = process.cwd();
  const candidate = path.isAbsolute(spec) ? spec : path.join(cwd, spec);
  const normalized = path.normalize(candidate);
  if (!normalized.startsWith(cwd)) {
    throw new Error('Config path must reside within the portal directory.');
  }
  return normalized;
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`Failed to parse inline JSON: ${error.message}`);
    }
  }
  return null;
}

function loadOnboardingConfig(input) {
  if (!input) {
    throw new Error('Onboarding config input is required.');
  }
  if (typeof input === 'string') {
    const asJson = parseMaybeJson(input);
    if (asJson) {
      return asJson;
    }
    const filePath = resolveConfigPath(input);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Config file not found at ${filePath}`);
    }
    const contents = fs.readFileSync(filePath, 'utf-8');
    try {
      return JSON.parse(contents);
    } catch (error) {
      throw new Error(`Failed to parse config file: ${error.message}`);
    }
  }
  if (typeof input === 'object') {
    return JSON.parse(JSON.stringify(input));
  }
  throw new Error('Unsupported onboarding config input.');
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function normalizeSchedule(value) {
  if (!value) return 'manual';
  const lower = String(value).toLowerCase();
  if (['manual', 'hourly', 'nightly'].includes(lower)) {
    return lower;
  }
  return 'manual';
}

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map(part => part.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeEnvironment(def) {
  return {
    name: normalizeString(def.name || def.title),
    type: normalizeString(def.type || def.category || 'web') || 'web',
    baseUrl: normalizeString(def.baseUrl || def.base_url || def.url),
    notes: normalizeString(def.notes || def.description)
  };
}

function normalizeTestCase(def) {
  const mode = normalizeString(def.playwrightMode || def.playwright_mode || def.mode || 'traditional') || 'traditional';
  const entryPoint = normalizeString(def.entryPoint || def.path || def.spec || def.scenarioPath || def.scenario);
  const mcpSource = normalizeString(def.mcpSource || def.mcp_source || def.scenario || def.scenarioPath);
  return {
    title: normalizeString(def.title || def.name),
    description: normalizeString(def.description || ''),
    feature: normalizeString(def.feature || def.module),
    type: normalizeString(def.type || 'playwright') || 'playwright',
    playwrightMode: mode,
    entryPoint: entryPoint || mcpSource,
    mcpSource: mcpSource || entryPoint,
    mcpConfig: typeof def.mcpConfig === 'object' ? def.mcpConfig : (typeof def.config === 'object' ? def.config : null),
    steps: asArray(def.steps),
    schedule: normalizeSchedule(def.schedule),
    captureArtifacts: def.captureArtifacts ?? def.capture_artifacts ?? true,
    tags: asArray(def.tags),
    environmentRef: def.environmentId ?? def.environment_id ?? def.environmentName ?? def.environment
  };
}

function applyOnboardingConfig(config, { dryRun = false } = {}) {
  if (!config || typeof config !== 'object') {
    throw new Error('Onboarding config must be an object.');
  }

  const summary = {
    dryRun,
    environments: { created: [], updated: [], skipped: [] },
    testCases: { created: [], updated: [], skipped: [] },
    errors: []
  };

  const existingEnvs = listEnvironments();
  const envByName = new Map(existingEnvs.map(env => [env.name.toLowerCase(), env]));
  const envById = new Map(existingEnvs.map(env => [env.id, env]));

  const desiredEnvs = Array.isArray(config.environments) ? config.environments : [];
  desiredEnvs.forEach(def => {
    try {
      const normalized = normalizeEnvironment(def);
      if (!normalized.name) {
        throw new Error('Environment name is required.');
      }
      if (!normalized.baseUrl) {
        throw new Error(`Environment ${normalized.name} missing baseUrl.`);
      }
      const key = normalized.name.toLowerCase();
      const existing = envByName.get(key);
      if (!existing) {
        if (!dryRun) {
          const created = createEnvironment(normalized);
          envByName.set(key, created);
          envById.set(created.id, created);
          summary.environments.created.push(created);
        } else {
          const placeholder = { id: -(summary.environments.created.length + 1), ...normalized };
          envByName.set(key, placeholder);
          envById.set(placeholder.id, placeholder);
          summary.environments.created.push({ ...placeholder, id: '(pending)' });
        }
        return;
      }
      const needsUpdate = (
        existing.type !== normalized.type ||
        existing.baseUrl !== normalized.baseUrl ||
        (existing.notes ?? '') !== (normalized.notes ?? '')
      );
      if (needsUpdate) {
        if (!dryRun) {
          const updated = updateEnvironment(existing.id, normalized);
          envByName.set(key, updated);
          envById.set(updated.id, updated);
          summary.environments.updated.push(updated);
        } else {
          const placeholder = { id: existing.id, ...normalized };
          envByName.set(key, placeholder);
          envById.set(existing.id, placeholder);
          summary.environments.updated.push(placeholder);
        }
      } else {
        summary.environments.skipped.push(existing);
      }
    } catch (error) {
      summary.errors.push(error.message);
    }
  });

  const existingCases = listTestCases();
  const caseByKey = new Map(
    existingCases.map(tc => [`${tc.title.toLowerCase()}::${tc.environmentId}`, tc])
  );

  const desiredCases = Array.isArray(config.testCases) ? config.testCases : [];
  desiredCases.forEach(def => {
    try {
      const normalized = normalizeTestCase(def);
      if (!normalized.title) {
        throw new Error('Test case title is required.');
      }
      if (!normalized.entryPoint) {
        throw new Error(`Test case ${normalized.title} missing entryPoint.`);
      }
      let environmentId = undefined;
      if (typeof normalized.environmentRef === 'number') {
        environmentId = normalized.environmentRef;
        if (!envById.has(environmentId)) {
          throw new Error(`Environment id ${environmentId} not found for ${normalized.title}.`);
        }
      } else if (normalized.environmentRef) {
        const envName = String(normalized.environmentRef).toLowerCase();
        const env = envByName.get(envName);
        if (!env) {
          throw new Error(`Environment ${normalized.environmentRef} not found for ${normalized.title}.`);
        }
        environmentId = env.id;
      } else {
        throw new Error(`Environment reference missing for ${normalized.title}.`);
      }

      const key = `${normalized.title.toLowerCase()}::${environmentId}`;
      const existing = caseByKey.get(key);
      const payload = {
        title: normalized.title,
        description: normalized.description,
        feature: normalized.feature,
        type: normalized.type,
        playwrightMode: normalized.playwrightMode,
        environmentId,
        entryPoint: normalized.entryPoint,
        mcpSource: normalized.mcpSource,
        mcpConfig: normalized.mcpConfig,
        steps: normalized.steps,
        schedule: normalized.schedule,
        captureArtifacts: normalized.captureArtifacts,
        tags: normalized.tags
      };

      if (!existing) {
        if (!dryRun) {
          const created = createTestCase(payload);
          caseByKey.set(key, created);
          summary.testCases.created.push(created);
        } else {
          summary.testCases.created.push({
            ...payload,
            environmentId: typeof normalized.environmentRef === 'string'
              ? normalized.environmentRef
              : payload.environmentId,
            id: '(pending)'
          });
        }
        return;
      }

      const needsUpdate = (
        existing.description !== payload.description ||
        existing.feature !== payload.feature ||
        existing.type !== payload.type ||
        existing.playwrightMode !== payload.playwrightMode ||
        (existing.mcpSource ?? '') !== (payload.mcpSource ?? '') ||
        JSON.stringify(existing.mcpConfig ?? null) !== JSON.stringify(payload.mcpConfig ?? null) ||
        existing.entryPoint !== payload.entryPoint ||
        existing.schedule !== payload.schedule ||
        existing.captureArtifacts !== payload.captureArtifacts ||
        !arraysEqual(existing.steps ?? [], payload.steps ?? []) ||
        !arraysEqual(existing.tags ?? [], payload.tags ?? [])
      );

      if (needsUpdate) {
        if (!dryRun) {
          const updated = updateTestCase(existing.id, payload);
          caseByKey.set(key, updated);
          summary.testCases.updated.push(updated);
        } else {
          summary.testCases.updated.push({
            id: existing.id,
            ...payload,
            environmentId: typeof normalized.environmentRef === 'string'
              ? normalized.environmentRef
              : payload.environmentId
          });
        }
      } else {
        summary.testCases.skipped.push(existing);
      }
    } catch (error) {
      summary.errors.push(error.message);
    }
  });

  return summary;
}

export {
  applyOnboardingConfig,
  loadOnboardingConfig
};
