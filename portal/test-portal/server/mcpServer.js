import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  createEnvironment,
  createTestCase,
  deleteTestCase,
  getEnvironment,
  getTestCase,
  listEnvironments,
  listRuns,
  listTestCases,
  updateEnvironment,
  updateTestCase
} from './storage.js';
import { enqueueRun } from './runManager.js';
import { applyOnboardingConfig, loadOnboardingConfig } from './onboarding.js';

const environmentBaseSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  baseUrl: z.string().min(1),
  authType: z.enum(['none', 'token', 'basic']).optional(),
  authToken: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  notes: z.string().optional()
});

function validateAuthRequirements(value, ctx) {
  if (value.authType === 'token' && !value.authToken) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'authToken is required when authType is token'
    });
  }
  if (value.authType === 'basic' && (!value.username || !value.password)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'username and password are required when authType is basic'
    });
  }
}

const environmentSchema = environmentBaseSchema.superRefine(validateAuthRequirements);
const environmentUpdateSchema = environmentBaseSchema.extend({
  id: z.coerce.number().int().min(1)
}).superRefine(validateAuthRequirements);

const testCaseBaseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  feature: z.string().optional(),
  type: z.enum(['ui', 'api', 'e2e', 'playwright']).optional(),
  environmentId: z.coerce.number().int().min(1),
  entryPoint: z.string().min(1),
  steps: z.array(z.string().min(1)).optional(),
  schedule: z.enum(['manual', 'hourly', 'nightly']).optional(),
  captureArtifacts: z.boolean().optional(),
  tags: z.array(z.string().min(1)).optional()
});

const listRunsSchema = z.object({
  testCaseId: z.coerce.number().int().min(1).optional()
}).partial();

function asContent(data) {
  return [{ type: 'text', text: JSON.stringify(data, null, 2) }];
}

async function main() {
  const server = new McpServer({
    name: 'playwright-mcp-server',
    version: '0.1.0',
    description: 'Orchestrates Playwright automation against TEKS MVP via MCP tools.'
  }, {
    capabilities: {
      logging: {},
      tools: { listChanged: true }
    }
  });

  server.registerTool('list-environments', {
    title: 'List Environments',
    description: 'Enumerate configured target environments.',
    inputSchema: z.object({
      type: z.string().optional()
    }).partial()
  }, async ({ type }) => {
    const environments = listEnvironments().filter(env => {
      if (!type) return true;
      return env.type.toLowerCase() === type.toLowerCase();
    });
    return { content: asContent(environments) };
  });

  server.registerTool('create-environment', {
    title: 'Create Environment',
    description: 'Add a new environment configuration to the portal.',
    inputSchema: environmentSchema
  }, async (input) => {
    const env = createEnvironment(input);
    return { content: asContent(env) };
  });

  server.registerTool('update-environment', {
    title: 'Update Environment',
    description: 'Update an existing environment configuration.',
    inputSchema: environmentUpdateSchema
  }, async ({ id, ...payload }) => {
    const existing = getEnvironment(id);
    if (!existing) {
      return {
        content: [{ type: 'text', text: `Environment ${id} not found` }],
        isError: true
      };
    }
    const env = updateEnvironment(id, payload);
    return { content: asContent(env) };
  });

  server.registerTool('list-test-cases', {
    title: 'List Test Cases',
    description: 'View registered Playwright scenarios with optional filters.',
    inputSchema: z.object({
      environmentId: z.coerce.number().int().min(1).optional(),
      feature: z.string().optional(),
      tag: z.string().optional(),
      type: z.string().optional()
    }).partial()
  }, async ({ environmentId, feature, tag, type }) => {
    let cases = listTestCases();
    if (environmentId) {
      cases = cases.filter(tc => tc.environmentId === environmentId);
    }
    if (feature) {
      cases = cases.filter(tc => tc.feature?.toLowerCase().includes(feature.toLowerCase()));
    }
    if (type) {
      cases = cases.filter(tc => tc.type.toLowerCase() === type.toLowerCase());
    }
    if (tag) {
      cases = cases.filter(tc => tc.tags.some(t => t.toLowerCase() === tag.toLowerCase()));
    }
    return { content: asContent(cases) };
  });

  server.registerTool('create-test-case', {
    title: 'Create Test Case',
    description: 'Register a new Playwright test scenario.',
    inputSchema: testCaseBaseSchema
  }, async (input) => {
    const payload = {
      ...input,
      type: input.type ?? 'ui',
      steps: input.steps ?? [],
      schedule: input.schedule ?? 'manual',
      captureArtifacts: input.captureArtifacts ?? true,
      tags: input.tags ?? []
    };
    const testCase = createTestCase(payload);
    return { content: asContent(testCase) };
  });

  server.registerTool('update-test-case', {
    title: 'Update Test Case',
    description: 'Update an existing Playwright scenario.',
    inputSchema: testCaseBaseSchema.extend({
      id: z.coerce.number().int().min(1)
    })
  }, async ({ id, ...rest }) => {
    const existing = getTestCase(id);
    if (!existing) {
      return {
        content: [{ type: 'text', text: `Test case ${id} not found` }],
        isError: true
      };
    }
    const payload = {
      ...rest,
      type: rest.type ?? existing.type,
      steps: rest.steps ?? existing.steps,
      schedule: rest.schedule ?? existing.schedule,
      captureArtifacts: rest.captureArtifacts ?? existing.captureArtifacts,
      tags: rest.tags ?? existing.tags
    };
    const updated = updateTestCase(id, payload);
    return { content: asContent(updated) };
  });

  server.registerTool('delete-test-case', {
    title: 'Delete Test Case',
    description: 'Remove a registered Playwright scenario.',
    inputSchema: z.object({
      id: z.coerce.number().int().min(1)
    })
  }, async ({ id }) => {
    const existing = getTestCase(id);
    if (!existing) {
      return {
        content: [{ type: 'text', text: `Test case ${id} not found` }],
        isError: true
      };
    }
    deleteTestCase(id);
    return { content: asContent({ deleted: id }) };
  });

  server.registerTool('run-test-case', {
    title: 'Run Test Case',
    description: 'Trigger Playwright execution for a scenario and return the queued run metadata.',
    inputSchema: z.object({
      id: z.coerce.number().int().min(1),
      triggeredBy: z.string().optional()
    })
  }, async ({ id, triggeredBy }) => {
    const existing = getTestCase(id);
    if (!existing) {
      return {
        content: [{ type: 'text', text: `Test case ${id} not found` }],
        isError: true
      };
    }
    const run = enqueueRun(id, triggeredBy ?? 'mcp');
    return { content: asContent(run) };
  });

  server.registerTool('list-test-runs', {
    title: 'List Test Runs',
    description: 'Inspect recent test run results with optional filtering.',
    inputSchema: listRunsSchema
  }, async ({ testCaseId } = {}) => {
    const runs = listRuns({ testCaseId });
    return { content: asContent(runs) };
  });

  server.registerTool('apply-onboarding-config', {
    title: 'Apply Onboarding Config',
    description: 'Bulk create or update environments and test cases from a config file or JSON string.',
    inputSchema: z.object({
      config: z.union([z.string(), z.record(z.any())]).optional(),
      path: z.string().optional(),
      dryRun: z.boolean().optional()
    }).refine(data => data.config || data.path, {
      message: 'Provide either config or path.'
    })
  }, async ({ config, path: configPath, dryRun }) => {
    const source = config ?? configPath;
    const onboardingConfig = loadOnboardingConfig(source);
    const result = applyOnboardingConfig(onboardingConfig, { dryRun: !!dryRun });
    return { content: asContent(result) };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Playwright MCP server is ready.');
}

main().catch(error => {
  console.error('Failed to start MCP server', error);
  process.exit(1);
});
