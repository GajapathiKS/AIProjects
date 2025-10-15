const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const yaml = require('js-yaml');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const Ajv = require('ajv');
const chalkLib = require('chalk');
const chalk = chalkLib.default || chalkLib;
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const schemaPath = path.join(__dirname, 'schema', 'mcp-scenario.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const validateScenarioShape = ajv.compile(schema);

const DEFAULT_WAIT_INTERVAL = 500;
const DEFAULT_WAIT_TIMEOUT = 15000;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function timestamp() {
  return new Date().toISOString();
}

function log(message) {
  console.log(`${chalk.gray(timestamp())} ${message}`);
}

function logStep(prefix, index, message) {
  const label = `[step ${String(index + 1).padStart(2, '0')}]`;
  console.log(`${chalk.gray(timestamp())} ${prefix} ${chalk.blue(label)} ${message}`);
}

function parseEnvFile(filePath) {
  const result = {};
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return;
      }
      const idx = trimmed.indexOf('=');
      if (idx === -1) {
        return;
      }
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      result[key] = value.replace(/^"|"$/g, '');
    });
  } catch {
    // ignore missing file
  }
  return result;
}

function loadSecrets() {
  const secrets = {};
  const secretsFile = process.env.MCP_SECRETS_FILE;
  if (secretsFile && fs.existsSync(secretsFile)) {
    Object.assign(secrets, parseEnvFile(secretsFile));
  }
  if (process.env.PLAYWRIGHT_MCP_USERNAME) {
    secrets.username = process.env.PLAYWRIGHT_MCP_USERNAME;
  }
  if (process.env.PLAYWRIGHT_MCP_PASSWORD) {
    secrets.password = process.env.PLAYWRIGHT_MCP_PASSWORD;
  }
  if (!secrets.username) {
    secrets.username = 'admin';
  }
  if (!secrets.password) {
    secrets.password = 'P@ssword1';
  }
  return secrets;
}

function getContextValue(pathExpression, context) {
  const parts = String(pathExpression)
    .split('.')
    .map(part => part.trim())
    .filter(Boolean);
  let current = context;
  for (const part of parts) {
    if (current == null) {
      return '';
    }
    current = current[part];
  }
  if (current == null) {
    return '';
  }
  return typeof current === 'object' ? current : String(current);
}

function applyTemplates(value, context) {
  if (typeof value === 'string') {
    return value.replace(/{{\s*([^}]+)\s*}}/g, (_, expr) => {
      const replacement = getContextValue(expr, context);
      if (replacement == null) {
        return '';
      }
      return typeof replacement === 'string' ? replacement : JSON.stringify(replacement);
    });
  }
  if (Array.isArray(value)) {
    return value.map(item => applyTemplates(item, context));
  }
  if (value && typeof value === 'object') {
    const result = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = applyTemplates(entry, context);
    }
    return result;
  }
  return value;
}

function resolveScenarioPath(rawPath) {
  if (!rawPath) {
    throw new Error('MCP scenario requires a source path.');
  }
  const repoRoot = path.resolve(__dirname, '..');
  const candidate = path.isAbsolute(rawPath) ? rawPath : path.join(repoRoot, rawPath);
  const normalized = path.normalize(candidate);
  if (!normalized.startsWith(repoRoot)) {
    throw new Error(`Scenario path ${rawPath} must be inside the repository.`);
  }
  if (!fs.existsSync(normalized)) {
    throw new Error(`Scenario file not found at ${normalized}`);
  }
  return normalized;
}

function normalizeStep(entry, index) {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`Step ${index + 1} must be an object.`);
  }
  if (entry.action) {
    const { action, ...rest } = entry;
    return { action, payload: Object.keys(rest).length ? rest : undefined };
  }
  const pairs = Object.entries(entry);
  if (pairs.length !== 1) {
    throw new Error(`Step ${index + 1} must contain exactly one action.`);
  }
  const [action, rawPayload] = pairs[0];
  if (rawPayload == null) {
    return { action, payload: undefined };
  }
  if (typeof rawPayload === 'object') {
    return { action, payload: rawPayload };
  }
  return { action, payload: { value: rawPayload } };
}

function normalizeScenarioObject(raw) {
  const scenario = raw || {};
  const metadata = scenario.metadata || {};
  if (!metadata.title && scenario.name) {
    metadata.title = scenario.name;
  }
  if (!metadata.description && scenario.description) {
    metadata.description = scenario.description;
  }
  if (!Array.isArray(metadata.tags) && Array.isArray(scenario.tags)) {
    metadata.tags = scenario.tags;
  }
  const configSource = scenario.config || scenario.options || {};
  const config = { ...configSource };
  if (config.baseURL && !config.baseUrl) {
    config.baseUrl = config.baseURL;
  }
  const stepsRaw = Array.isArray(scenario.steps) ? scenario.steps : [];
  const steps = stepsRaw.map(normalizeStep);
  const variables = scenario.variables || {};
  return { metadata, config, steps, variables };
}

function loadScenarioFile(filePath, baseContext) {
  const contents = fs.readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(contents);
  if (!validateScenarioShape(parsed)) {
    const errors = ajv.errorsText(validateScenarioShape.errors, { separator: '\n' });
    throw new Error(`Scenario schema validation failed:\n${errors}`);
  }
  const normalized = normalizeScenarioObject(parsed);
  const context = { ...baseContext, metadata: normalized.metadata, config: normalized.config, vars: { ...normalized.variables } };
  const metadata = applyTemplates(normalized.metadata, context);
  const config = applyTemplates(normalized.config, { ...context, metadata });
  return { metadata, config, steps: normalized.steps, variables: normalized.variables };
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value === 'boolean') return value;
  const truthy = ['true', '1', 'yes', 'on'];
  return truthy.includes(String(value).toLowerCase());
}

function sanitizeName(value, fallback = 'artifact') {
  return (value || fallback)
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || fallback;
}

async function wait(ms) {
  await delay(ms);
}

async function poll(check, { timeout = DEFAULT_WAIT_TIMEOUT, interval = DEFAULT_WAIT_INTERVAL, onTick } = {}) {
  const end = Date.now() + timeout;
  while (true) {
    const result = await check();
    if (result) {
      return true;
    }
    if (Date.now() > end) {
      throw new Error('Condition not met before timeout.');
    }
    if (onTick) {
      onTick();
    }
    await wait(interval);
  }
}

async function callTool(client, name, args) {
  return client.callTool({ name, arguments: args });
}

function collectText(result) {
  if (!result || !Array.isArray(result.content)) return '';
  return result.content
    .map(entry => {
      if (typeof entry?.text === 'string') {
        return entry.text;
      }
      if (entry?.type === 'text' && typeof entry.value === 'string') {
        return entry.value;
      }
      return '';
    })
    .filter(Boolean)
    .join('')
    .trim();
}

function isTruthyResult(result) {
  const text = collectText(result).toLowerCase();
  if (!text) return false;
  return ['true', '1', 'yes', 'on'].includes(text);
}

function normalizeTargetInput(target) {
  if (!target) {
    return {};
  }
  if (typeof target === 'string') {
    const trimmed = target.trim();
    if (trimmed.startsWith('role=')) {
      const roleExpr = trimmed.slice('role='.length);
      const match = roleExpr.match(/([^\[]+)(?:\[(.+)\])?/);
      const role = match ? match[1].trim() : roleExpr.trim();
      const options = { role };
      if (match && match[2]) {
        const inner = match[2];
        const nameMatch = inner.match(/name\s*=\s*"([^"]+)"/i);
        if (nameMatch) {
          options.name = nameMatch[1];
        }
      }
      return options;
    }
    if (trimmed.startsWith('data-testid=')) {
      return { testId: trimmed.slice('data-testid='.length).replace(/^"|"$/g, '') };
    }
    if (trimmed.startsWith('text=')) {
      return { text: trimmed.slice('text='.length).replace(/^"|"$/g, '') };
    }
    if (trimmed.startsWith('css=')) {
      return { css: trimmed.slice('css='.length) };
    }
    return { selector: trimmed };
  }
  if (typeof target === 'object') {
    return { ...target };
  }
  throw new Error('Unsupported target type.');
}

function describeTarget(target) {
  if (!target) {
    return '';
  }
  const normalized = normalizeTargetInput(target);
  if (normalized.selector) {
    return normalized.selector;
  }
  if (normalized.css) {
    return normalized.css;
  }
  if (normalized.testId) {
    return `data-testid="${normalized.testId}"`;
  }
  if (normalized.role) {
    const parts = [`role=${normalized.role}`];
    if (normalized.name) {
      parts.push(`name="${normalized.name}"`);
    }
    return parts.join(' ');
  }
  if (normalized.text) {
    return `text contains "${normalized.text}"`;
  }
  return 'target';
}

function buildDomHelpersScript() {
  return `
    const __implicitRoles = {
      button: 'button',
      summary: 'button',
      input: 'textbox',
      textarea: 'textbox',
      select: 'combobox',
      a: 'link',
      h1: 'heading',
      h2: 'heading',
      h3: 'heading',
      h4: 'heading',
      h5: 'heading',
      h6: 'heading'
    };
    function __mcpRole(el) {
      const explicit = el.getAttribute('role');
      if (explicit) return explicit.toLowerCase();
      const tag = el.tagName.toLowerCase();
      const implicit = __implicitRoles[tag];
      if (implicit === 'heading') {
        return 'heading';
      }
      return implicit || '';
    }
    function __mcpName(el) {
      const aria = el.getAttribute('aria-label');
      if (aria) return aria.trim();
      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        const labelEl = document.getElementById(labelledBy);
        if (labelEl) {
          return (labelEl.textContent || '').trim();
        }
      }
      if (el.tagName.toLowerCase() === 'input') {
        const id = el.getAttribute('id');
        if (id) {
          const label = document.querySelector('label[for="' + id + '"]');
          if (label) {
            return (label.textContent || '').trim();
          }
        }
      }
      return (el.textContent || '').trim();
    }
    function __mcpMatchesText(el, text, exact) {
      if (!text) return true;
      const content = (el.textContent || '').trim();
      if (exact) {
        return content === text;
      }
      return content.includes(text);
    }
    function __mcpMatchesTarget(el, target) {
      if (!el) return false;
      if (target.selector) {
        return el.matches(target.selector);
      }
      if (target.css) {
        return el.matches(target.css);
      }
      if (target.testId) {
        return el.getAttribute('data-testid') === target.testId;
      }
      if (target.role) {
        if (__mcpRole(el) !== target.role.toLowerCase()) {
          return false;
        }
        if (target.name && !__mcpMatchesText(el, target.name, target.exact)) {
          return false;
        }
        return true;
      }
      if (target.text) {
        return __mcpMatchesText(el, target.text, target.exact);
      }
      return true;
    }
    function __mcpQueryAll(target, within) {
      const root = within || document;
      if (target.selector) {
        return Array.from(root.querySelectorAll(target.selector));
      }
      if (target.css) {
        return Array.from(root.querySelectorAll(target.css));
      }
      if (target.testId) {
        return Array.from(root.querySelectorAll('[data-testid="' + target.testId + '"]'));
      }
      const all = Array.from(root.querySelectorAll('*'));
      return all.filter(el => __mcpMatchesTarget(el, target));
    }
  `;
}

function buildLocatorScript(target, options = {}) {
  const normalized = normalizeTargetInput(target);
  const within = options.within ? normalizeTargetInput(options.within) : null;
  const helpers = buildDomHelpersScript();
  return `() => {
    ${helpers}
    const target = ${JSON.stringify(normalized)};
    const withinTarget = ${within ? JSON.stringify(within) : 'null'};
    const withinNode = withinTarget ? (__mcpQueryAll(withinTarget)[0] || null) : null;
    const matches = __mcpQueryAll(target, withinNode);
    return matches[${typeof normalized.nth === 'number' ? normalized.nth : '0'}] || null;
  }`;
}

function buildExistsScript(target, options = {}) {
  const normalized = normalizeTargetInput(target);
  const within = options.within ? normalizeTargetInput(options.within) : null;
  const helpers = buildDomHelpersScript();
  return `() => {
    ${helpers}
    const target = ${JSON.stringify(normalized)};
    const withinTarget = ${within ? JSON.stringify(within) : 'null'};
    const withinNode = withinTarget ? (__mcpQueryAll(withinTarget)[0] || null) : null;
    const matches = __mcpQueryAll(target, withinNode);
    return matches.length > 0;
  }`;
}

function buildVisibleScript(target, options = {}) {
  const normalized = normalizeTargetInput(target);
  const within = options.within ? normalizeTargetInput(options.within) : null;
  const helpers = buildDomHelpersScript();
  return `() => {
    ${helpers}
    const target = ${JSON.stringify(normalized)};
    const withinTarget = ${within ? JSON.stringify(within) : 'null'};
    const withinNode = withinTarget ? (__mcpQueryAll(withinTarget)[0] || null) : null;
    const matches = __mcpQueryAll(target, withinNode);
    if (!matches.length) return false;
    const el = matches[0];
    const rect = el.getBoundingClientRect();
    return !!rect.width || !!rect.height;
  }`;
}

function buildTextContentScript(target, options = {}) {
  const normalized = normalizeTargetInput(target);
  const within = options.within ? normalizeTargetInput(options.within) : null;
  const helpers = buildDomHelpersScript();
  return `() => {
    ${helpers}
    const target = ${JSON.stringify(normalized)};
    const withinTarget = ${within ? JSON.stringify(within) : 'null'};
    const withinNode = withinTarget ? (__mcpQueryAll(withinTarget)[0] || null) : null;
    const matches = __mcpQueryAll(target, withinNode);
    if (!matches.length) return '';
    return (matches[0].textContent || '').trim();
  }`;
}

function formatError(error) {
  if (!error) return 'Unknown error';
  if (error.stack) return error.stack;
  if (error.message) return error.message;
  return String(error);
}

async function waitForServerReady(server) {
  const { url, waitTimeout = 180000, retryInterval = 1000 } = server;
  if (!url) {
    return;
  }
  log(`Waiting for ${server.name || server.command} at ${url}`);
  await poll(async () => {
    try {
      const res = await fetch(url, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  }, { timeout: waitTimeout, interval: retryInterval });
}

async function startServersIfNeeded(servers = [], artifactDir) {
  if (!servers.length) {
    return { stop: async () => {} };
  }
  const processes = [];
  for (const server of servers) {
    const { command, cwd, env, name } = server;
    const label = name || command;
    log(`Starting server ${chalk.green(label)}`);
    const proc = spawn(command, {
      cwd: cwd ? path.resolve(cwd) : process.cwd(),
      env: { ...process.env, ...env },
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    processes.push({ proc, server });
    const stdoutLog = path.join(artifactDir, `${sanitizeName(label)}.out.log`);
    const stderrLog = path.join(artifactDir, `${sanitizeName(label)}.err.log`);
    proc.stdout?.pipe(fs.createWriteStream(stdoutLog));
    proc.stderr?.pipe(fs.createWriteStream(stderrLog));
    await waitForServerReady(server);
  }
  return {
    stop: async () => {
      for (const { proc } of processes) {
        if (!proc.killed) {
          proc.kill();
        }
      }
    }
  };
}

async function executeStep(client, rawStep, index, context, recorder) {
  const start = Date.now();
  const payload = applyTemplates(rawStep.payload ?? {}, context);
  const step = { action: rawStep.action, payload };
  const detail = step.payload?.target ? describeTarget(step.payload.target) : (step.payload?.selector || step.payload?.url || step.payload?.message || '');
  logStep(chalk.green('▶'), index, `${chalk.bold(step.action)}${detail ? chalk.gray(` (${detail})`) : ''}`);
  const record = { action: step.action, status: 'passed', startedAt: new Date(start).toISOString(), payload: step.payload };
  try {
    await runAction(client, step, context, recorder);
    record.durationMs = Date.now() - start;
    recorder.events.push(record);
    logStep(chalk.green('✔'), index, `${chalk.bold(step.action)} completed in ${record.durationMs}ms`);
  } catch (error) {
    record.status = 'failed';
    record.durationMs = Date.now() - start;
    record.detail = error?.message || String(error);
    recorder.events.push(record);
    logStep(chalk.red('✖'), index, `${chalk.bold(step.action)} failed after ${record.durationMs}ms: ${chalk.red(record.detail)}`);
    throw error;
  } finally {
    if (context.runtime.debugDelay > 0) {
      await wait(context.runtime.debugDelay);
    }
  }
}
async function runAction(client, step, context, recorder) {
  switch (step.action) {
    case 'navigate': {
      const targetUrl = step.payload?.url || step.payload?.value || step.payload;
      if (!targetUrl) throw new Error('navigate step requires url');
      const url = targetUrl.startsWith('http')
        ? targetUrl
        : `${context.config.baseUrl.replace(/\/$/, '')}/${targetUrl.replace(/^\//, '')}`;
      await callTool(client, 'browser_navigate', { url });
      if (step.payload?.waitFor) {
        const waitTimeout = step.payload?.timeout || context.config.timeout || DEFAULT_WAIT_TIMEOUT;
        await poll(async () => {
          const result = await callTool(client, 'browser_evaluate', { function: '() => window.location.href' });
          const href = collectText(result);
          if (!href) {
            return false;
          }
          if (step.payload.waitFor === 'url') {
            return href.startsWith(url);
          }
          if (typeof step.payload.waitFor === 'string') {
            return href.includes(step.payload.waitFor);
          }
          return true;
        }, { timeout: waitTimeout });
      }
      break;
    }
    case 'waitFor': {
      const target = step.payload?.target || step.payload;
      const timeout = step.payload?.timeout || context.config.timeout || DEFAULT_WAIT_TIMEOUT;
      const text = step.payload?.text || step.payload?.contains;
      if (!target) {
        const duration = Number(step.payload?.milliseconds ?? step.payload?.duration ?? 1000);
        await wait(duration);
        break;
      }
      const script = text
        ? buildTextContentScript(target, { within: step.payload?.within })
        : buildExistsScript(target, { within: step.payload?.within });
      await poll(async () => {
        const result = await callTool(client, 'browser_evaluate', { function: script });
        if (text) {
          const value = collectText(result);
          return value.includes(text);
        }
        return isTruthyResult(result);
      }, { timeout });
      break;
    }
    case 'expectVisible': {
      const target = step.payload?.target || step.payload;
      const timeout = step.payload?.timeout || context.config.timeout || DEFAULT_WAIT_TIMEOUT;
      const script = buildVisibleScript(target, { within: step.payload?.within });
      await poll(async () => {
        const result = await callTool(client, 'browser_evaluate', { function: script });
        return isTruthyResult(result);
      }, { timeout });
      break;
    }
    case 'expectText': {
      const target = step.payload?.target || step.payload;
      const expected = step.payload?.equals || step.payload?.contains || step.payload?.text || step.payload?.value;
      if (!expected) throw new Error('expectText requires text');
      const timeout = step.payload?.timeout || context.config.timeout || DEFAULT_WAIT_TIMEOUT;
      const equals = Boolean(step.payload?.equals);
      const script = buildTextContentScript(target, { within: step.payload?.within });
      await poll(async () => {
        const result = await callTool(client, 'browser_evaluate', { function: script });
        const value = collectText(result);
        if (!value) return false;
        if (equals) {
          return value.trim() === expected;
        }
        return value.includes(expected);
      }, { timeout });
      break;
    }
    case 'expectUrl': {
      const expected = step.payload?.equals || step.payload?.contains || step.payload?.value;
      if (!expected) throw new Error('expectUrl requires expected value');
      const timeout = step.payload?.timeout || context.config.timeout || DEFAULT_WAIT_TIMEOUT;
      const equals = Boolean(step.payload?.equals);
      await poll(async () => {
        const result = await callTool(client, 'browser_evaluate', { function: '() => window.location.href' });
        const href = collectText(result);
        if (!href) return false;
        if (equals) {
          return href === expected;
        }
        return href.includes(expected);
      }, { timeout });
      break;
    }
    case 'fill': {
      const target = step.payload?.target || step.payload?.selector || step.payload;
      const value = step.payload?.value ?? step.payload?.text ?? '';
      const script = `() => {
        ${buildDomHelpersScript()}
        const target = ${JSON.stringify(normalizeTargetInput(target))};
        const el = (__mcpQueryAll(target)[0] || null);
        if (!el) throw new Error('Selector not found for fill');
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          el.focus();
          el.value = ${JSON.stringify(value)};
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          el.textContent = ${JSON.stringify(value)};
        }
        return true;
      }`;
      await callTool(client, 'browser_evaluate', { function: script });
      break;
    }
    case 'click': {
      const target = step.payload?.target || step.payload?.selector || step.payload;
      const script = `() => {
        ${buildDomHelpersScript()}
        const target = ${JSON.stringify(normalizeTargetInput(target))};
        const el = (__mcpQueryAll(target)[0] || null);
        if (!el) throw new Error('Selector not found for click');
        el.click();
        return true;
      }`;
      await callTool(client, 'browser_evaluate', { function: script });
      break;
    }
    case 'screenshot': {
      const info = typeof step.payload === 'string' ? { name: step.payload } : (step.payload || {});
      const name = sanitizeName(info.name || `step-${context.runtime.stepCounter + 1}`);
      const screenshotsDir = path.join(context.runtime.artifactDir, 'screenshots');
      ensureDir(screenshotsDir);
      const filename = `${String(context.runtime.stepCounter + 1).padStart(4, '0')}-${name}.png`;
      const result = await callTool(client, 'browser_take_screenshot', {
        type: 'png',
        filename,
        fullPage: toBoolean(info.fullPage, true)
      });
      const imageEntry = result?.content?.find(entry => entry.type === 'image');
      if (imageEntry?.data) {
        const buffer = Buffer.from(imageEntry.data, 'base64');
        fs.writeFileSync(path.join(screenshotsDir, filename), buffer);
        recorder.screenshots.push({
          title: name,
          project: 'mcp',
          status: 'captured',
          fileName: filename,
          relativePath: path.join('screenshots', filename)
        });
      }
      break;
    }
    case 'wait':
    case 'sleep': {
      const duration = Number(step.payload?.milliseconds ?? step.payload?.duration ?? step.payload?.value ?? 1000);
      await wait(duration);
      break;
    }
    case 'setContext':
    case 'set': {
      const entries = step.payload && typeof step.payload === 'object' ? Object.entries(step.payload) : [];
      for (const [key, value] of entries) {
        context.vars[key] = value;
      }
      break;
    }
    case 'apiAuth': {
      const url = step.payload?.url || `${context.environment.apiBaseUrl.replace(/\/$/, '')}/api/auth/login`;
      const credentials = step.payload?.credentials || { username: context.secrets.username, password: context.secrets.password };
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      if (!resp.ok) {
        throw new Error(`Authentication failed with status ${resp.status}`);
      }
      const data = await resp.json();
      const token = data?.token || data?.accessToken;
      if (!token) {
        throw new Error('Authentication response missing token');
      }
      const saveKey = step.payload?.saveAs || 'apiToken';
      context.vars[saveKey] = token;
      break;
    }
    case 'apiRequest': {
      const method = (step.payload?.method || 'GET').toUpperCase();
      const urlInput = step.payload?.url || step.payload?.endpoint;
      if (!urlInput) throw new Error('apiRequest requires url');
      const url = urlInput.startsWith('http')
        ? urlInput
        : `${context.environment.apiBaseUrl.replace(/\/$/, '')}/${urlInput.replace(/^\//, '')}`;
      const headers = { 'Content-Type': 'application/json', ...(step.payload?.headers || {}) };
      if (step.payload?.auth !== false) {
        const tokenKey = typeof step.payload?.auth === 'string' ? step.payload.auth : 'apiToken';
        const token = context.vars[tokenKey];
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }
      const body = step.payload?.body !== undefined ? JSON.stringify(step.payload.body) : undefined;
      const resp = await fetch(url, { method, headers, body });
      if (!resp.ok) {
        throw new Error(`apiRequest failed with status ${resp.status}`);
      }
      let data = null;
      try {
        data = await resp.json();
      } catch {
        data = await resp.text();
      }
      if (step.payload?.saveAs) {
        context.vars[step.payload.saveAs] = data;
      }
      break;
    }
    case 'evaluate': {
      const script = typeof step.payload === 'string' ? step.payload : step.payload?.script;
      if (!script) throw new Error('evaluate step requires script');
      await callTool(client, 'browser_evaluate', { function: script });
      break;
    }
    case 'log': {
      const message = step.payload?.message || step.payload?.value || step.payload;
      if (message) {
        log(chalk.magenta(`[scenario] ${message}`));
      }
      break;
    }
    default:
      throw new Error(`Unsupported MCP step: ${step.action}`);
  }
  context.runtime.stepCounter += 1;
}
async function runMcpScenario({
  file,
  artifactRoot,
  startServer = false,
  debug = false,
  additionalContext = {}
}) {
  const scenarioPath = resolveScenarioPath(file);
  const baseArtifacts = artifactRoot || path.join(path.dirname(scenarioPath), '..', 'test-results', 'mcp');
  ensureDir(baseArtifacts);
  const runStamp = Date.now();
  const artifactDir = path.join(baseArtifacts, `run-${runStamp}`);
  ensureDir(artifactDir);

  const baseUrl = additionalContext.baseUrl || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4200';
  const apiBaseUrl = additionalContext.apiBaseUrl || process.env.TEST_API_BASE || 'https://localhost:7140';
  const secrets = loadSecrets();
  const projectRoot = path.resolve(__dirname, '..');
  const repoRoot = path.resolve(projectRoot, '..', '..');
  const backendApiRoot = path.join(repoRoot, 'backend', 'src', 'SpecialPrograms.Api');
  const runtime = {
    runId: runStamp,
    startedAt: new Date().toISOString(),
    artifactDir,
    stepCounter: 0,
    debugDelay: debug ? 500 : 0,
    projectRoot,
    frontendRoot: projectRoot,
    repoRoot,
    backendApiRoot
  };
  const baseContext = {
    environment: { baseUrl, apiBaseUrl },
    runtime,
    secrets,
    vars: {},
    ...additionalContext
  };
  const { metadata, config: configInput, steps, variables } = loadScenarioFile(scenarioPath, baseContext);
  const config = {
    baseUrl: configInput.baseUrl || baseUrl,
    apiBaseUrl: configInput.apiBaseUrl || apiBaseUrl,
    browser: configInput.browser || 'chromium',
    headless: toBoolean(configInput.headless, true),
    timeout: configInput.timeout ? Number(configInput.timeout) : DEFAULT_WAIT_TIMEOUT,
    waitInterval: configInput.waitInterval ? Number(configInput.waitInterval) : DEFAULT_WAIT_INTERVAL,
    servers: Array.isArray(configInput.servers) ? configInput.servers : [],
    webServerTimeout: configInput.webServerTimeout ? Number(configInput.webServerTimeout) : 180000,
    ensureBaseUrl: configInput.ensureBaseUrl,
    allowInsecureApiTls: toBoolean(configInput.allowInsecureApiTls ?? configInput.insecureApiTls ?? configInput.allowInsecureTls, false),
    ...configInput
  };
  baseContext.environment.apiBaseUrl = config.apiBaseUrl;
  baseContext.config = config;
  baseContext.metadata = metadata;
  baseContext.vars = { ...(variables || {}) };

  const events = [];
  const screenshots = [];
  const recorder = { events, screenshots };

  const originalRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  let serverHandle = { stop: async () => {} };
  const cleanup = async () => {
    await serverHandle.stop();
    if (config.allowInsecureApiTls) {
      if (originalRejectUnauthorized === undefined) {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      } else {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalRejectUnauthorized;
      }
    }
  };

  try {
    if (config.allowInsecureApiTls) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
    if (startServer) {
      const servers = config.servers.length ? config.servers : [
        {
          name: 'angular-app',
          command: 'npx ng serve --port 4200 --host 0.0.0.0',
          cwd: path.resolve(__dirname, '..'),
          url: config.baseUrl,
          waitTimeout: config.webServerTimeout,
          retryInterval: 1000
        }
      ];
      serverHandle = await startServersIfNeeded(servers, artifactDir);
    } else if (config.ensureBaseUrl) {
      await waitForServerReady({
        command: 'baseUrl-check',
        name: 'baseUrl-check',
        url: config.ensureBaseUrl,
        waitTimeout: config.webServerTimeout,
        retryInterval: 1000
      });
    }

    const args = ['mcp-server-playwright', '--browser', config.browser];
    if (config.headless) {
      args.push('--headless');
    }
    const outputDir = path.join(artifactDir, 'mcp-output');
    ensureDir(outputDir);
    args.push('--output-dir', outputDir);
    if (toBoolean(process.env.MCP_SAVE_TRACE)) {
      args.push('--save-trace');
    }
    if (process.env.MCP_SECRETS_FILE && fs.existsSync(process.env.MCP_SECRETS_FILE)) {
      args.push('--secrets', process.env.MCP_SECRETS_FILE);
    }

    const transport = new StdioClientTransport({
      command: 'npx',
      args,
      cwd: path.resolve(__dirname, '..'),
      stderr: 'pipe'
    });
    const stderrPath = path.join(artifactDir, 'mcp.stderr.log');
    const stderrStream = transport.stderr;
    const stderrWriter = fs.createWriteStream(stderrPath);
    if (stderrStream) {
      stderrStream.on('data', chunk => stderrWriter.write(chunk));
    }

    const client = new Client({ name: 'Playwright MCP CLI', version: '1.0.0' });

    let status = 'passed';
    let summary = 'Executed MCP scenario successfully';

    try {
      await client.connect(transport);
      for (let i = 0; i < steps.length; i += 1) {
        await executeStep(client, steps[i], i, baseContext, recorder);
      }
    } catch (error) {
      status = 'failed';
      summary = error?.message ? `Scenario failed: ${error.message}` : 'Scenario failed';
      try {
        await runAction(client, { action: 'screenshot', payload: { name: 'failure' } }, baseContext, recorder);
      } catch (shotError) {
        console.error('Failed to capture failure screenshot:', shotError.message);
      }
      throw error;
    } finally {
      try {
        await client.close();
      } catch {}
      stderrWriter.end();
    }

    const reportFile = 'transcript.json';
    const transcript = {
      metadata,
      config,
      steps: events,
      screenshots,
      status,
      summary,
      scenarioPath
    };
    fs.writeFileSync(path.join(artifactDir, reportFile), JSON.stringify(transcript, null, 2));

    return {
      status,
      summary,
      artifactDir,
      reportFile,
      screenshots
    };
  } catch (error) {
    const reportFile = 'transcript.json';
    const transcript = {
      metadata,
      config,
      steps: recorder.events,
      screenshots,
      status: 'failed',
      summary: error?.message ? `Scenario failed: ${error.message}` : 'Scenario failed',
      scenarioPath,
      error: formatError(error)
    };
    fs.writeFileSync(path.join(artifactDir, reportFile), JSON.stringify(transcript, null, 2));
    throw error;
  } finally {
    await cleanup();
  }
}

module.exports = {
  runMcpScenario,
  loadScenarioFile,
  schemaPath
};
