import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

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

    fs.mkdirSync(artifactDir, { recursive: true });
    const stdoutPath = path.join(artifactDir, 'stdout.log');
    const stderrPath = path.join(artifactDir, 'stderr.log');
    const jsonReportPath = path.join(artifactDir, 'report.json');

    const out = fs.createWriteStream(stdoutPath);
    const err = fs.createWriteStream(stderrPath);

    // Build arguments
    const args = [
      'test',
      '-c', 'playwright.config.ts',
      testCase.entry_point ?? testCase.entryPoint,
      '--reporter', 'json',
      '--trace', 'on'
    ].filter(Boolean);

    // Environment variables
    const env = {
      ...process.env,
      // Base URL for UI
      PLAYWRIGHT_BASE_URL: environment.base_url ?? environment.baseUrl ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4200',
      // Backend API base for test seed utils
      TEST_API_BASE: process.env.TEST_API_BASE ?? 'https://localhost:7140',
      // Always collect trace & screenshots for recordability
      PWTRACE: 'on',
    };

    // Spawn Playwright via npx for portability
    const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['playwright', ...args], {
      cwd: frontendDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let jsonBuffer = '';
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
          const report = JSON.parse(jsonText);
          const total = report?.suites?.[0]?.specs?.length ?? report?.stats?.tests ?? undefined;
          const failures = report?.stats?.failures ?? 0;
          status = failures > 0 ? 'failed' : status;
          summary = `Tests: ${total ?? 'n/a'}, Failures: ${failures}`;
        }
      } catch (e) {
        // Leave default summary on parse failure
      }

      // Copy test-results folder for artifacts
      try {
        const testResultsDir = path.join(frontendDir, 'test-results');
        const dest = path.join(artifactDir, 'test-results');
        if (fs.existsSync(testResultsDir)) {
          fs.cpSync(testResultsDir, dest, { recursive: true });
        }
      } catch {}

      resolve({ status, summary, jsonReportPath });
    });
  });
}
