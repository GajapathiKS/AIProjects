#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const chalkLib = require('chalk');
const chalk = chalkLib.default || chalkLib;

function extractString(argument) {
  if (!argument) return '';
  const trimmed = argument.trim();
  if ((trimmed.startsWith('`') && trimmed.endsWith('`')) || (trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('await')) {
    return null;
  }

  let match = trimmed.match(/page\.goto\((.+)\)/);
  if (match) {
    return {
      action: 'navigate',
      payload: { url: extractString(match[1]) }
    };
  }

  match = trimmed.match(/page\.getByRole\(([^)]+)\)\.click\(\)/);
  if (match) {
    const [rolePart, optionsPart] = match[1].split(',').map(part => part.trim());
    const role = extractString(rolePart);
    const nameMatch = (optionsPart || '').match(/name:\s*['\"]([^'\"]+)['\"]/);
    return {
      action: 'click',
      payload: {
        target: {
          role,
          name: nameMatch ? nameMatch[1] : undefined
        }
      }
    };
  }

  match = trimmed.match(/page\.getByRole\(([^)]+)\)\.fill\((.+)\)/);
  if (match) {
    const [rolePart, optionsPart] = match[1].split(',').map(part => part.trim());
    const role = extractString(rolePart);
    const nameMatch = (optionsPart || '').match(/name:\s*['\"]([^'\"]+)['\"]/);
    return {
      action: 'fill',
      payload: {
        target: {
          role,
          name: nameMatch ? nameMatch[1] : undefined
        },
        value: extractString(match[2])
      }
    };
  }

  match = trimmed.match(/page\.getByTestId\(([^)]+)\)\.click\(\)/);
  if (match) {
    return {
      action: 'click',
      payload: {
        target: { testId: extractString(match[1]) }
      }
    };
  }

  match = trimmed.match(/page\.getByTestId\(([^)]+)\)\.fill\((.+)\)/);
  if (match) {
    return {
      action: 'fill',
      payload: {
        target: { testId: extractString(match[1]) },
        value: extractString(match[2])
      }
    };
  }

  match = trimmed.match(/page\.getByLabel\(([^)]+)\)\.fill\((.+)\)/);
  if (match) {
    return {
      action: 'fill',
      payload: {
        target: {
          selector: `label:has-text(\"${extractString(match[1])}\") ~ input, label:has-text(\"${extractString(match[1])}\") ~ textarea`
        },
        value: extractString(match[2])
      }
    };
  }

  match = trimmed.match(/expect\(page\)\.toHaveURL\((.+)\)/);
  if (match) {
    return {
      action: 'expectUrl',
      payload: { contains: extractString(match[1]) }
    };
  }

  match = trimmed.match(/expect\(page\.getByRole\(([^)]+)\)\)\.toBeVisible\(\)/);
  if (match) {
    const [rolePart, optionsPart] = match[1].split(',').map(part => part.trim());
    const role = extractString(rolePart);
    const nameMatch = (optionsPart || '').match(/name:\s*['\"]([^'\"]+)['\"]/);
    return {
      action: 'expectVisible',
      payload: {
        target: {
          role,
          name: nameMatch ? nameMatch[1] : undefined
        }
      }
    };
  }

  match = trimmed.match(/expect\(page\.getByText\(([^)]+)\)\)\.toBeVisible\(\)/);
  if (match) {
    return {
      action: 'expectVisible',
      payload: {
        target: { text: extractString(match[1]) }
      }
    };
  }

  return null;
}

function main() {
  const [, , file] = process.argv;
  if (!file) {
    console.error('Usage: node convert-spec.js <path-to-spec.ts>');
    process.exit(1);
  }
  const specPath = path.resolve(file);
  if (!fs.existsSync(specPath)) {
    console.error(chalk.red(`Spec file not found at ${specPath}`));
    process.exit(1);
  }
  const contents = fs.readFileSync(specPath, 'utf-8');
  const steps = [];
  for (const line of contents.split(/\r?\n/)) {
    const step = parseLine(line);
    if (step) {
      steps.push(step);
    }
  }

  const yamlSteps = steps.map(step => {
    if (!step.payload || Object.keys(step.payload).length === 0) {
      return `  - ${step.action}`;
    }
    const body = JSON.stringify(step.payload, null, 2)
      .replace(/"([^\"]+)":/g, '$1:')
      .replace(/["{}]/g, '')
      .replace(/\n/g, '\n    ')
      .trim();
    return `  - ${step.action}:
      ${body}`;
  }).join('\n');

  const yaml = `name: Derived scenario from ${path.basename(file)}
description: Auto-generated skeleton – review selectors and timings.
config:
  baseUrl: http://localhost:4200
steps:
${yamlSteps || '  - log: { message: "Add steps" }'}
`;

  console.log(yaml);
}

main();
