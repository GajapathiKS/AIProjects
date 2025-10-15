#!/usr/bin/env node
import process from 'node:process';
import { applyOnboardingConfig, loadOnboardingConfig } from '../server/onboarding.js';

function parseArgs(argv) {
  const args = argv.slice(2);
  let file = null;
  let dryRun = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--file' || arg === '-f') {
      file = args[i + 1];
      i += 1;
    } else if (!file) {
      file = arg;
    }
  }

  return { file, dryRun };
}

async function main() {
  try {
    const { file, dryRun } = parseArgs(process.argv);
    const source = file ?? 'onboarding.sample.json';
    const config = loadOnboardingConfig(source);
    const result = applyOnboardingConfig(config, { dryRun });
    console.log(JSON.stringify(result, null, 2));
    if (dryRun) {
      console.log('\nDry run complete. Re-run without --dry-run to apply changes.');
    }
  } catch (error) {
    console.error(`Failed to apply onboarding: ${error?.message ?? error}`);
    process.exitCode = 1;
  }
}

main();
