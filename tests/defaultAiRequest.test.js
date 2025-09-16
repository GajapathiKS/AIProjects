import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { defaultAiRequest, DEFAULT_AI_CONFIG } from '../src/index.js';

const originalFetch = global.fetch;

afterEach(() => {
  if (originalFetch === undefined) {
    delete global.fetch;
  } else {
    global.fetch = originalFetch;
  }
});

test('defaultAiRequest builds an OpenAI-compatible payload with defaults', async () => {
  let received;
  global.fetch = async (url, options) => {
    received = { url, options };
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Updated text' } }] })
    };
  };

  const config = {
    ...DEFAULT_AI_CONFIG,
    endpoint: 'https://example.com/v1/chat/completions',
    apiKey: 'secret-key',
    model: 'gpt-custom'
  };

  const result = await defaultAiRequest({
    text: 'Original input',
    instruction: 'Fix grammar',
    config,
    prompt: { id: 'fix', label: 'Fix grammar', instruction: 'Fix grammar' }
  });

  assert.equal(result, 'Updated text');
  assert.equal(received.url, 'https://example.com/v1/chat/completions');
  assert.equal(received.options.method, 'POST');
  const body = JSON.parse(received.options.body);
  assert.equal(body.model, 'gpt-custom');
  assert.equal(body.messages[1].content, 'Fix grammar\n\nOriginal input');
  assert.equal(received.options.headers.Authorization, 'Bearer secret-key');
});

test('defaultAiRequest forwards prompt metadata to custom payload builders', async () => {
  let seenContext;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ output: 'rewritten text' })
  });

  const config = {
    endpoint: 'https://example.com',
    buildPayload: (ctx) => {
      seenContext = ctx;
      return { body: ctx.text, promptUsed: ctx.prompt.id };
    },
    transformResponse: (data) => data.output
  };

  const prompt = { id: 'expand', label: 'Expand', instruction: 'Expand the text' };

  const result = await defaultAiRequest({
    text: 'Hello world',
    instruction: 'Expand the text',
    config,
    prompt
  });

  assert.equal(result, 'rewritten text');
  assert.deepEqual(seenContext.prompt, prompt);
  assert.equal(seenContext.instruction, 'Expand the text');
});
