#!/usr/bin/env node
const path = require('node:path');
const fs = require('node:fs');
const { hideBin } = require('yargs/helpers');
const yargs = require('yargs/yargs');
const chalkLib = require('chalk');
const chalk = chalkLib.default || chalkLib;
const { runMcpScenario, schemaPath } = require('./runner');

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('file', {
      alias: 'f',
      type: 'string',
      demandOption: true,
      describe: 'Path to the MCP YAML scenario file'
    })
    .option('artifacts', {
      alias: 'a',
      type: 'string',
      default: path.join('test-results', 'mcp'),
      describe: 'Directory where artifacts and transcripts are written'
    })
    .option('start-server', {
      type: 'boolean',
      default: false,
      describe: 'Automatically start configured servers before execution'
    })
    .option('debug', {
      type: 'boolean',
      default: false,
      describe: 'Enable verbose logging and slow down execution for debugging'
    })
    .option('context', {
      type: 'string',
      describe: 'Optional JSON file that provides additional template context values'
    })
    .option('env', {
      type: 'array',
      describe: 'Additional KEY=VALUE pairs passed to the runner context'
    })
    .option('print-schema', {
      type: 'boolean',
      describe: 'Print the JSON schema path used for validation and exit'
    })
    .option('dry-run', {
      type: 'boolean',
      default: false,
      describe: 'Validate the scenario and print metadata without executing it'
    })
    .help()
    .alias('h', 'help')
    .parse();

  if (argv['print-schema']) {
    console.log(schemaPath);
    return;
  }

  const context = {};
  if (argv.context) {
    const contextPath = path.resolve(argv.context);
    if (!fs.existsSync(contextPath)) {
      console.error(chalk.red(`Context file not found at ${contextPath}`));
      process.exitCode = 1;
      return;
    }
    Object.assign(context, JSON.parse(fs.readFileSync(contextPath, 'utf-8')));
  }
  if (Array.isArray(argv.env)) {
    for (const pair of argv.env) {
      const idx = String(pair).indexOf('=');
      if (idx === -1) {
        continue;
      }
      const key = pair.slice(0, idx);
      const value = pair.slice(idx + 1);
      context[key] = value;
    }
  }

  try {
    if (argv['dry-run']) {
      const projectRoot = path.resolve(__dirname, '..');
      const repoRoot = path.resolve(projectRoot, '..', '..');
      const backendApiRoot = path.join(repoRoot, 'backend', 'src', 'SpecialPrograms.Api');
      const { metadata, config } = require('./runner').loadScenarioFile(path.resolve(argv.file), {
        environment: {},
        runtime: {
          runId: Date.now(),
          startedAt: new Date().toISOString(),
          projectRoot,
          frontendRoot: projectRoot,
          repoRoot,
          backendApiRoot
        },
        secrets: {},
        vars: {},
        ...context
      });
      console.log(JSON.stringify({ metadata, config, schema: schemaPath }, null, 2));
      return;
    }

    const result = await runMcpScenario({
      file: argv.file,
      artifactRoot: path.resolve(argv.artifacts),
      startServer: argv['start-server'],
      debug: argv.debug,
      additionalContext: context
    });

    const output = {
      status: result.status,
      summary: result.summary,
      artifactDir: result.artifactDir,
      report: path.join(result.artifactDir, result.reportFile),
      screenshots: result.screenshots
    };
    console.log(JSON.stringify(output, null, 2));
    if (result.status !== 'passed') {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(chalk.red('Scenario execution failed'));
    console.error(chalk.red(error?.stack || error?.message || String(error)));
    process.exitCode = 1;
  }
}

main();
