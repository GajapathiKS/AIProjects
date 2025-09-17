# Voice Assist Plugin

A framework-agnostic voice and AI assistant that can be plugged into any web application. The plugin listens for focus events on text inputs, textareas, and `contenteditable` elements, then displays an overlay with:

- **Speech-to-text** capture using the browser's Web Speech API.
- **AI-powered text transformations** such as fixing grammar, summarising, or expanding content.
- **On-page AI configuration** so that end users can switch models, endpoints, or keys without redeploying your app.

The library is written in plain JavaScript and exports a single class that you can import from any Node.js-based bundler (Webpack, Vite, Next.js, Create React App, Angular CLI, etc.) or reference directly in vanilla JS via an ES module `<script>` tag.

## Installation

Add the package to your project (adjust the path to where you place the plugin source):

```bash
npm install ./path/to/voice-assist-plugin
# or
pnpm add ./path/to/voice-assist-plugin
```

You can also copy the `src` directory into your project if you prefer to bundle it directly.

## Quick start

```js
import VoiceAssistPlugin from 'voice-assist-plugin';

const assist = new VoiceAssistPlugin({
  aiConfig: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    apiKey: process.env.MY_AI_KEY,
    model: 'gpt-3.5-turbo'
  },
  speechConfig: {
    locale: 'en-US',
    insertionMode: 'append' // append | replace-selection | replace-all
  }
});
```

Once instantiated, the assistant attaches itself to all focusable text inputs within the current document. Click inside any text box and the overlay appears.

> **TypeScript**: The package ships with type declarations so you get IntelliSense and compile-time safety out of the box.

### Vanilla JavaScript example

A ready-to-run example is located at [`examples/basic.html`](examples/basic.html). Open it via a local web server (for example `npx serve examples`) and provide your AI endpoint/key through the configuration panel.

### React demo application

A complete Vite starter that wires the plugin into a React component lives in [`examples/react-app`](examples/react-app/). Install
the dependencies and start the dev server:

```bash
cd examples/react-app
npm install
npm run dev
```

Then visit [http://localhost:5173](http://localhost:5173) and focus the textarea to summon the assistant overlay.

### Angular demo application

An Angular CLI standalone project showcasing the same integration is available at
[`examples/angular-app`](examples/angular-app/):

```bash
cd examples/angular-app
npm install
npm start
```

Open [http://localhost:4200](http://localhost:4200) in your browser and click into the textarea. Use the gear icon inside the
overlay to enter your API key or to switch models at runtime.

### React usage

```jsx
import { useEffect } from 'react';
import VoiceAssistPlugin from 'voice-assist-plugin';

export function EditorPage() {
  useEffect(() => {
    const plugin = new VoiceAssistPlugin({
      aiConfig: {
        endpoint: process.env.REACT_APP_AI_ENDPOINT,
        apiKey: process.env.REACT_APP_AI_KEY,
        model: 'gpt-4o'
      }
    });

    return () => plugin.destroy();
  }, []);

  return <textarea placeholder="Start typing…" />;
}
```

### Angular usage

```ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import VoiceAssistPlugin from 'voice-assist-plugin';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-editor',
  template: `<textarea placeholder="Start typing…"></textarea>`
})
export class EditorComponent implements OnInit, OnDestroy {
  private plugin?: VoiceAssistPlugin;

  ngOnInit() {
    this.plugin = new VoiceAssistPlugin({
      aiConfig: {
        endpoint: environment.aiEndpoint,
        apiKey: environment.aiKey,
        model: 'gpt-3.5-turbo'
      }
    });
  }

  ngOnDestroy() {
    this.plugin?.destroy();
  }
}
```

## Configuration

### AI configuration (`aiConfig`)

| Option | Type | Description |
| ------ | ---- | ----------- |
| `endpoint` | `string` | **Required**. The HTTP endpoint for your LLM/chat completion provider. |
| `apiKey` | `string` | Optional API key. If omitted, you can fill it through the in-page configuration panel. |
| `model` | `string` | Model name sent to the default OpenAI-style payload builder. |
| `headers` | `Record<string, string>` | Extra headers to send with every request. |
| `systemPrompt` | `string` | Optional system prompt used by the default payload builder. |
| `buildPayload` | `(ctx) => object` | Custom function to build the request body. Receives `{ instruction, text, config, prompt }`. |
| `transformResponse` | `(data) => string` | Custom function to extract the assistant text from the response object. |

Call `plugin.setAIConfig(nextConfig)` at any time to update the settings programmatically. The UI also exposes a configuration panel (gear icon) that writes to the same store, making dynamic model switching trivial.

You can completely replace the network call by supplying your own `aiRequest` function:

```js
const plugin = new VoiceAssistPlugin({
  aiRequest: async ({ text, instruction, prompt, config }) => {
    const response = await fetch('/api/rewrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, instruction, promptId: prompt.id })
    });
    const data = await response.json();
    return data.output;
  }
});
```

If you want to reuse the built-in OpenAI-compatible request helper, import `defaultAiRequest`:

```js
import VoiceAssistPlugin, { defaultAiRequest } from 'voice-assist-plugin';

const plugin = new VoiceAssistPlugin({
  aiRequest: (ctx) => defaultAiRequest({ ...ctx, config: {
    ...ctx.config,
    endpoint: 'https://my-proxy.example.com/v1/chat/completions'
  } })
});
```

### Speech recognition (`speechConfig`)

| Option | Type | Description |
| ------ | ---- | ----------- |
| `locale` | `string` | Locale passed to `SpeechRecognition.lang` (default `en-US`). |
| `interimResults` | `boolean` | Whether interim results should be captured. |
| `insertionMode` | `'append' \| 'replace-selection' \| 'replace-all'` | How speech and AI results are inserted. |

Speech capture uses the [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API). If the API is not available, the plugin displays an inline warning and disables the button.

Call `plugin.setSpeechConfig({ insertionMode: 'replace-all' })` at runtime to change how speech results are inserted, or inspect the current settings with `plugin.getSpeechConfig()`.

### Prompts (`prompts`)

Provide an array of objects `{ id, label, instruction }`. Use `plugin.setPrompts([...])` to swap them at runtime. Each prompt becomes a button inside the overlay.

```js
plugin.setPrompts([
  { id: 'shorten', label: 'Shorten', instruction: 'Rewrite the text to be shorter.' },
  { id: 'headline', label: 'Create headline', instruction: 'Write a punchy headline for the following copy.' }
]);
```

### Other options

| Option | Type | Description |
| ------ | ---- | ----------- |
| `autoAttach` | `boolean` | Set to `false` to instantiate the plugin without registering global focus listeners. Call `plugin.attach()` manually when needed. |
| `aiInsertionMode` | `'append' \| 'replace-selection' \| 'replace-all'` | Controls how AI responses are placed when no text is selected. Use `plugin.setAiInsertionMode(mode)` to swap it at runtime. |

## Dynamic model switching via UI

End users can click the **⚙️ Config** button to open a form where they can update the endpoint, model, API key, and system prompt. The plugin stores the values in-memory and uses them for subsequent requests without reloading the page.

## Accessing the active element

If you need to trigger actions manually you can use:

```js
plugin.runAiAction(plugin.prompts[0]);
plugin.startSpeechCapture();
```

## Browser support

- Speech-to-text requires Chrome, Edge, or any Chromium-based browser with the Web Speech API enabled.
- AI requests rely on the Fetch API. Supply a custom `aiRequest` if you target browsers without `fetch`.
- The overlay is rendered using standard DOM APIs and works alongside React, Angular, Vue, Svelte, or vanilla JavaScript inputs.

## Development

- `npm test` – placeholder command.
- `examples/basic.html` – open via a static file server to experiment locally.

## License

MIT
