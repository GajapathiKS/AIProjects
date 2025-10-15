import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

function sanitizeSegment(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function collectScreenshotArtifacts({ report, runId, artifactDir, timestamp }) {
  if (!report) {
    return [];
  }
  const screenshotsDir = path.join(artifactDir, 'screenshots');
  ensureDir(screenshotsDir);

  const collected = [];

  function walkSuites(suites, ancestors = []) {
    if (!Array.isArray(suites)) return;
    suites.forEach((suite) => {
      const suiteTrail = suite?.title ? [...ancestors, suite.title] : ancestors;
      if (Array.isArray(suite?.tests)) {
        suite.tests.forEach((test) => {
          const testTrail = [...suiteTrail, test?.title].filter(Boolean);
          const project = test?.projectName ?? test?.project ?? '';
          const results = Array.isArray(test?.results) ? test.results : [];
          results.forEach((result, resultIndex) => {
            const status = result?.status ?? test?.outcome ?? (result?.error ? 'failed' : 'passed');
            const attachments = Array.isArray(result?.attachments) ? result.attachments : [];
            attachments.forEach((attachment, attachmentIndex) => {
              const name = attachment?.name?.toLowerCase?.() ?? '';
              const isImage = attachment?.contentType?.startsWith?.('image/') ?? false;
              if (!isImage && !name.includes('screenshot')) {
                return;
              }
              const sourcePath = attachment?.path;
              const hasBody = attachment?.body && typeof attachment.body === 'string';
              if (!sourcePath && !hasBody) {
                return;
              }
              const slug = sanitizeSegment([
                ...testTrail,
                project,
                status,
                `r${resultIndex + 1}`,
                `a${attachmentIndex + 1}`
              ].filter(Boolean).join('-')) || `run-${runId}`;
              const ext = path.extname(sourcePath ?? '') || '.png';
              const destFile = `${String(runId).padStart(4, '0')}-${timestamp}-${slug}${ext}`;
              const destPath = path.join(screenshotsDir, destFile);

              try {
                if (sourcePath && fs.existsSync(sourcePath)) {
                  fs.copyFileSync(sourcePath, destPath);
                } else if (hasBody) {
                  const buffer = Buffer.from(attachment.body, 'base64');
                  fs.writeFileSync(destPath, buffer);
                } else {
                  return;
                }
                collected.push({
                  title: testTrail.join(' › '),
                  project: project || undefined,
                  status,
                  fileName: destFile,
                  relativePath: path.join('screenshots', destFile)
                });
              } catch (error) {
                console.warn(`Failed to capture screenshot artifact for run ${runId}:`, error);
              }
            });
          });
        });
      }
      if (Array.isArray(suite?.suites)) {
        walkSuites(suite.suites, suiteTrail);
      }
    });
  }

  walkSuites(report?.suites ?? []);
  return collected;
}

function countTests(suites) {
  if (!Array.isArray(suites)) return 0;
  return suites.reduce((total, suite) => {
    const own = Array.isArray(suite?.tests) ? suite.tests.length : 0;
    return total + own + countTests(suite?.suites ?? []);
  }, 0);
}

/**
 * Run Playwright tests for the teks-mvp app.
 * @param {object} opts
 * @param {number} opts.runId - DB run id for artifact folder naming.
 * @param {object} opts.testCase - Test case row with entryPoint and optional tags.
 * @param {object} opts.environment - Environment row with base_url and auth details.
 * @param {string} opts.artifactDir - Absolute path to run artifacts dir.
 * @returns {Promise<{ status: 'passed' | 'failed', summary: string, jsonReportPath: string }>} Result
 */
export function runPlaywright({ runId, testCase, environment, artifactDir }) {
  return new Promise((resolve, reject) => {
    const frontendDir = path.resolve(process.cwd(), '..', '..', 'frontend', 'teks-mvp');

    if (!fs.existsSync(frontendDir)) {
      return reject(new Error(`Playwright project not found at ${frontendDir}`));
    }

    ensureDir(artifactDir);
    const stdoutPath = path.join(artifactDir, 'stdout.log');
    const stderrPath = path.join(artifactDir, 'stderr.log');
    const jsonReportPath = path.join(artifactDir, 'report.json');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  const out = fs.createWriteStream(stdoutPath);
  const err = fs.createWriteStream(stderrPath);

    // Build arguments for Playwright
    const entryRaw = testCase.entry_point ?? testCase.entryPoint;
    // Normalize entry to be relative to the Playwright project directory
    let entry = entryRaw;
    if (entry) {
      const norm = String(entry).replace(/\\/g, '/');
      if (norm.startsWith('frontend/teks-mvp/')) {
        entry = norm.substring('frontend/teks-mvp/'.length);
      } else {
        entry = norm;
      }
    }
    const pwArgs = [
      'test',
      '-c', 'playwright.config.ts',
      entry,
      '--reporter', 'json',
      '--trace', 'on'
    ].filter(Boolean);

    // Environment variables
    const rawEnv = {
      ...process.env,
      // Base URL for UI
      PLAYWRIGHT_BASE_URL: environment.base_url ?? environment.baseUrl ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4200',
      // Backend API base for test seed utils
      TEST_API_BASE: process.env.TEST_API_BASE ?? 'https://localhost:7140',
      // Optional: provide an auth token directly to tests (used by login helper)
      E2E_AUTH_TOKEN: environment.auth_token ?? environment.authToken ?? process.env.E2E_AUTH_TOKEN,
      // Always collect trace & screenshots for recordability
      PWTRACE: 'on',
    };
    // Remove undefined/null values (Windows spawn will fail with EINVAL for invalid env)
    const env = Object.fromEntries(
      Object.entries(rawEnv).filter(([_, v]) => v !== undefined && v !== null)
    );

    // Prefer executing via Node using the Playwright CLI JS (most robust on Windows)
    const cliJs = path.join(frontendDir, 'node_modules', '@playwright', 'test', 'cli.js');
    const localCli = path.join(frontendDir, 'node_modules', '.bin', process.platform === 'win32' ? 'playwright.cmd' : 'playwright');

    let cmd;
    let cmdArgs;
  let spawnOpts = { cwd: frontendDir, env, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' };

    if (process.platform === 'win32') {
      // Use npm script for reliability on Windows
      cmd = 'cmd.exe';
      const extra = [entry, '--reporter', 'json', '--trace', 'on'].filter(Boolean);
      cmdArgs = ['/c', 'npm', 'run', 'test:e2e', '--', ...extra];
    } else if (fs.existsSync(cliJs)) {
      cmd = process.execPath || 'node';
      cmdArgs = [cliJs, ...pwArgs];
    } else if (fs.existsSync(localCli)) {
      cmd = localCli;
      cmdArgs = pwArgs;
    } else {
      cmd = 'npx';
      cmdArgs = ['playwright', ...pwArgs];
    }

    // Note: writing chosen command for diagnostics
    try {
      fs.appendFileSync(stdoutPath, `\n[runner] cmd: ${cmd}\n[runner] args: ${JSON.stringify(cmdArgs)}\n`);
    } catch {}

  const child = spawn(cmd, cmdArgs, spawnOpts);

    let jsonBuffer = '';
    let report = null;
    child.stdout.on('data', (chunk) => {
      out.write(chunk);
      jsonBuffer += chunk.toString();
    });
    child.stderr.on('data', (chunk) => err.write(chunk));

    child.on('error', (e) => {
  try { out.end(); } catch {}
  try { err.end(); } catch {}
      reject(e);
    });

    child.on('close', (code) => {
      try { out.end(); } catch {}
      try { err.end(); } catch {}

      // Try to parse the JSON reporter output
      let status = code === 0 ? 'passed' : 'failed';
      let summary = `Exited with code ${code}`;
      try {
        const lastBracket = jsonBuffer.lastIndexOf('}');
        const startBracket = jsonBuffer.indexOf('{');
        if (startBracket !== -1 && lastBracket !== -1) {
          const jsonText = jsonBuffer.slice(startBracket, lastBracket + 1);
          fs.writeFileSync(jsonReportPath, jsonText);
          report = JSON.parse(jsonText);
          const total = report?.stats?.tests ?? countTests(report?.suites ?? []);
          const failures = report?.stats?.failures ?? 0;
          const skipped = report?.stats?.skipped ?? 0;
          if (failures > 0) {
            status = 'failed';
          } else if (total > 0 && skipped === total) {
            status = 'skipped';
          } else if (!total || total === 0) {
            // No tests were discovered — most likely an invalid entry path
            status = 'failed';
            summary = `No tests found for entry '${entryRaw}'. Check the test case entryPoint path.`;
          }
          summary = `Tests: ${total ?? 'n/a'}, Failures: ${failures}, Skipped: ${skipped ?? 0}`;
        }
      } catch (e) {
        // Leave default summary on parse failure
      }

      const screenshots = collectScreenshotArtifacts({
        report,
        runId,
        artifactDir,
        timestamp
      });

      // Copy test-results folder for artifacts
      try {
        const testResultsDir = path.join(frontendDir, 'test-results');
        const dest = path.join(artifactDir, 'test-results');
        if (fs.existsSync(testResultsDir)) {
          fs.cpSync(testResultsDir, dest, { recursive: true });
        }
      } catch {}

      resolve({
        status,
        summary,
        jsonReportPath: path.relative(artifactDir, jsonReportPath),
        screenshots
      });
    });
  });
}
