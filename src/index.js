const DEFAULT_PROMPTS = [
  {
    id: 'improve-clarity',
    label: 'Improve clarity',
    instruction: 'Rewrite the following text to make it clearer while keeping the same meaning.'
  },
  {
    id: 'fix-grammar',
    label: 'Fix grammar',
    instruction: 'Fix grammar and spelling issues in the following text without changing the original meaning.'
  },
  {
    id: 'summarize',
    label: 'Summarize',
    instruction: 'Summarize the following text in a concise paragraph.'
  },
  {
    id: 'expand',
    label: 'Expand',
    instruction: 'Expand on the following text by adding more detail and context.'
  }
];

const DEFAULT_AI_CONFIG = {
  provider: 'openai-compatible',
  endpoint: '',
  apiKey: '',
  model: 'gpt-3.5-turbo',
  headers: {},
  systemPrompt: 'You are a helpful writing assistant.'
};

const STYLE_ID = 'voice-assist-plugin-style';
const BASE_STYLES = `
.voice-assist-plugin-container {
  position: absolute;
  z-index: 99999;
  width: 320px;
  max-width: 90vw;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.15);
  background: #ffffff;
  font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
  color: #0f172a;
  overflow: hidden;
  transform-origin: top left;
  animation: va-fade-in 120ms ease-out;
}

.voice-assist-plugin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  color: #fff;
}

.voice-assist-plugin-header h2 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.voice-assist-plugin-header-buttons {
  display: flex;
  gap: 0.35rem;
  align-items: center;
}

.voice-assist-plugin-body {
  padding: 0.75rem 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.voice-assist-plugin-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.voice-assist-plugin-section h3 {
  margin: 0;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #475569;
}

.voice-assist-plugin-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.voice-assist-plugin-button {
  appearance: none;
  border: none;
  border-radius: 999px;
  padding: 0.45rem 0.9rem;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: #e2e8f0;
  color: #0f172a;
  transition: background 120ms ease, transform 120ms ease;
}

.voice-assist-plugin-button.primary {
  background: #2563eb;
  color: #fff;
}

.voice-assist-plugin-button:hover {
  background: #cbd5f5;
  transform: translateY(-1px);
}

.voice-assist-plugin-button:disabled,
.voice-assist-plugin-button[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.voice-assist-plugin-status {
  min-height: 1.25rem;
  font-size: 0.75rem;
  color: #334155;
}

.voice-assist-plugin-status.error {
  color: #dc2626;
}

.voice-assist-plugin-status.success {
  color: #16a34a;
}

.voice-assist-plugin-config {
  border-top: 1px solid #e2e8f0;
  padding-top: 0.75rem;
  display: none;
  flex-direction: column;
  gap: 0.65rem;
}

.voice-assist-plugin-config.open {
  display: flex;
}

.voice-assist-plugin-config label {
  display: flex;
  flex-direction: column;
  font-size: 0.75rem;
  color: #475569;
  gap: 0.35rem;
}

.voice-assist-plugin-config input,
.voice-assist-plugin-config textarea {
  border-radius: 8px;
  border: 1px solid #cbd5f5;
  padding: 0.45rem 0.6rem;
  font-size: 0.8rem;
  font-family: inherit;
}

.voice-assist-plugin-config textarea {
  resize: vertical;
  min-height: 60px;
}

.voice-assist-plugin-config-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

@keyframes va-fade-in {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}
`;

const VALID_INSERTION_MODES = ['append', 'replace-selection', 'replace-all'];

function normalizeInsertionMode(mode, fallback = 'append') {
  if (typeof mode === 'string' && VALID_INSERTION_MODES.includes(mode)) {
    return mode;
  }
  return fallback;
}

function mergeSpeechConfig(baseConfig = {}, patch = {}) {
  const merged = { ...baseConfig, ...(patch || {}) };
  merged.insertionMode = normalizeInsertionMode(
    merged.insertionMode,
    baseConfig.insertionMode ?? 'append'
  );
  if (!merged.insertionMode) {
    merged.insertionMode = 'append';
  }
  return merged;
}

function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = BASE_STYLES;
  document.head.appendChild(style);
}

function isTextLikeElement(element) {
  if (!element) return false;
  const tagName = element.tagName ? element.tagName.toLowerCase() : '';
  if (tagName === 'textarea') return true;
  if (tagName === 'input') {
    const type = element.type ? element.type.toLowerCase() : 'text';
    return ['text', 'search', 'email', 'url', 'tel', 'number', 'password'].includes(type);
  }
  if (element.isContentEditable) return true;
  return false;
}

function getActiveSelection(element) {
  if (!element) {
    return { text: '', range: null, start: null, end: null };
  }

  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? start;
    return {
      text: element.value.slice(start, end),
      range: null,
      start,
      end
    };
  }

  if (element.isContentEditable) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (element.contains(range.commonAncestorContainer)) {
        return { text: selection.toString(), range, start: null, end: null };
      }
    }
  }

  return { text: '', range: null, start: null, end: null };
}

function replaceSelection(element, replacement) {
  if (!element) return;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? element.value.length;
    const before = element.value.slice(0, start);
    const after = element.value.slice(end);
    const nextValue = `${before}${replacement}${after}`;
    const cursorPosition = start + replacement.length;
    element.value = nextValue;
    element.setSelectionRange(cursorPosition, cursorPosition);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  if (element.isContentEditable) {
    element.focus({ preventScroll: true });
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (!element.contains(range.commonAncestorContainer)) {
        selection.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(element);
        newRange.collapse(false);
        selection.addRange(newRange);
      }
      range.deleteContents();
      range.insertNode(document.createTextNode(replacement));
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      element.append(document.createTextNode(replacement));
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function replaceAllText(element, text) {
  if (!element) return;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.value = text;
    const caret = element.value.length;
    element.setSelectionRange(caret, caret);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  if (element.isContentEditable) {
    element.focus({ preventScroll: true });
    element.textContent = text;
    const selection = window.getSelection();
    if (selection) {
      selection.selectAllChildren(element);
      selection.collapseToEnd();
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function appendText(element, text) {
  if (!element) return;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const nextValue = `${element.value}${text}`;
    element.value = nextValue;
    element.setSelectionRange(nextValue.length, nextValue.length);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  if (element.isContentEditable) {
    element.focus({ preventScroll: true });
    element.append(document.createTextNode(text));
    const selection = window.getSelection();
    if (selection) {
      selection.selectAllChildren(element);
      selection.collapseToEnd();
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function buildPromptedInput({ instruction, text, systemPrompt }) {
  const userContent = `${instruction}\n\n${text}`;
  return {
    model: 'gpt-3.5-turbo',
    systemPrompt,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ]
  };
}

async function defaultAiRequest({ text, instruction, config, signal, prompt }) {
  if (!config || !config.endpoint) {
    throw new Error('AI endpoint is not configured. Provide an endpoint in the plugin configuration.');
  }

  if (typeof fetch !== 'function') {
    throw new Error('Fetch API is not available in this environment. Provide a custom aiRequest implementation.');
  }

  const headers = Object.assign(
    {
      'Content-Type': 'application/json'
    },
    config.headers || {}
  );

  if (config.apiKey && !headers.Authorization) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  const payloadBuilder = typeof config.buildPayload === 'function'
    ? config.buildPayload
    : ({ instruction: inst, text: content, config: cfg }) => {
      const prompt = buildPromptedInput({
        instruction: inst,
        text: content,
        systemPrompt: cfg.systemPrompt || DEFAULT_AI_CONFIG.systemPrompt
      });
      return {
        model: cfg.model || DEFAULT_AI_CONFIG.model,
        messages: prompt.messages
      };
    };

  const payload = payloadBuilder({
    instruction,
    text,
    config,
    prompt: prompt || {
      id: 'custom',
      label: 'Custom request',
      instruction
    }
  });

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (typeof config.transformResponse === 'function') {
    return config.transformResponse(data);
  }

  const content = data?.choices?.[0]?.message?.content
    || data?.choices?.[0]?.text
    || data?.output
    || data?.result;

  if (!content) {
    throw new Error('Unexpected AI response format. Provide a transformResponse function to map it.');
  }

  return String(content).trim();
}

class AssistUI {
  constructor(plugin) {
    this.plugin = plugin;
    this.container = null;
    this.statusNode = null;
    this.promptButtonsWrapper = null;
    this.configSection = null;
    this.configForm = null;
    this.speechButton = null;
    this.speechStopButton = null;
    this.resizeObserver = null;
    this.observedElement = null;
    this.isVisible = false;
    this.speechSupported = true;
    ensureStyles();
    this.createUI();
  }

  createUI() {
    if (typeof document === 'undefined') return;
    this.container = document.createElement('div');
    this.container.className = 'voice-assist-plugin-container';
    this.container.tabIndex = -1;

    const header = document.createElement('div');
    header.className = 'voice-assist-plugin-header';
    const title = document.createElement('h2');
    title.textContent = 'Voice & AI Assistant';
    header.appendChild(title);

    const headerButtons = document.createElement('div');
    headerButtons.className = 'voice-assist-plugin-header-buttons';

    const configToggle = document.createElement('button');
    configToggle.type = 'button';
    configToggle.className = 'voice-assist-plugin-button';
    configToggle.title = 'Configure AI model';
    configToggle.innerHTML = '⚙️ Config';
    configToggle.addEventListener('click', () => {
      this.toggleConfig();
    });

    headerButtons.appendChild(configToggle);

    header.appendChild(headerButtons);

    const body = document.createElement('div');
    body.className = 'voice-assist-plugin-body';

    const speechSection = document.createElement('div');
    speechSection.className = 'voice-assist-plugin-section';
    const speechTitle = document.createElement('h3');
    speechTitle.textContent = 'Speech to text';
    speechSection.appendChild(speechTitle);
    const speechActions = document.createElement('div');
    speechActions.className = 'voice-assist-plugin-actions';

    this.speechButton = document.createElement('button');
    this.speechButton.type = 'button';
    this.speechButton.className = 'voice-assist-plugin-button primary';
    this.speechButton.textContent = '🎤 Start speaking';

    this.speechStopButton = document.createElement('button');
    this.speechStopButton.type = 'button';
    this.speechStopButton.className = 'voice-assist-plugin-button';
    this.speechStopButton.textContent = '⏹ Stop';
    this.speechStopButton.disabled = true;

    this.speechButton.addEventListener('click', () => this.plugin.startSpeechCapture());
    this.speechStopButton.addEventListener('click', () => this.plugin.stopSpeechCapture());

    speechActions.appendChild(this.speechButton);
    speechActions.appendChild(this.speechStopButton);
    speechSection.appendChild(speechActions);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.speechSupported = Boolean(SpeechRecognition);
    if (!this.speechSupported) {
      this.speechButton.disabled = true;
      this.speechButton.textContent = '🎤 Not supported';
      this.speechButton.title = 'Speech recognition is unavailable in this browser.';
      this.speechStopButton.disabled = true;
    }

    const aiSection = document.createElement('div');
    aiSection.className = 'voice-assist-plugin-section';
    const aiTitle = document.createElement('h3');
    aiTitle.textContent = 'AI reformatting';
    aiSection.appendChild(aiTitle);

    this.promptButtonsWrapper = document.createElement('div');
    this.promptButtonsWrapper.className = 'voice-assist-plugin-actions';
    aiSection.appendChild(this.promptButtonsWrapper);

    const status = document.createElement('div');
    status.className = 'voice-assist-plugin-status';
    this.statusNode = status;

    this.configSection = document.createElement('div');
    this.configSection.className = 'voice-assist-plugin-config';
    this.configForm = document.createElement('form');

    const endpointField = this.createLabeledInput('Endpoint URL', 'text', 'endpoint');
    const apiKeyField = this.createLabeledInput('API key (optional)', 'text', 'apiKey');
    const modelField = this.createLabeledInput('Model name', 'text', 'model');
    const systemPromptField = this.createLabeledTextarea('System prompt (optional)', 'systemPrompt');

    this.configForm.appendChild(endpointField);
    this.configForm.appendChild(apiKeyField);
    this.configForm.appendChild(modelField);
    this.configForm.appendChild(systemPromptField);

    const configActions = document.createElement('div');
    configActions.className = 'voice-assist-plugin-config-actions';
    const cancelConfig = document.createElement('button');
    cancelConfig.type = 'button';
    cancelConfig.className = 'voice-assist-plugin-button';
    cancelConfig.textContent = 'Cancel';
    cancelConfig.addEventListener('click', () => this.toggleConfig(false));

    const saveConfig = document.createElement('button');
    saveConfig.type = 'submit';
    saveConfig.className = 'voice-assist-plugin-button primary';
    saveConfig.textContent = 'Save';

    configActions.appendChild(cancelConfig);
    configActions.appendChild(saveConfig);
    this.configForm.appendChild(configActions);

    this.configForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(this.configForm);
      const nextConfig = {
        ...this.plugin.getAIConfig(),
        endpoint: formData.get('endpoint') || '',
        apiKey: formData.get('apiKey') || '',
        model: formData.get('model') || '',
        systemPrompt: formData.get('systemPrompt') || ''
      };
      this.plugin.setAIConfig(nextConfig);
      this.toggleConfig(false);
      this.setStatus('AI configuration updated.', 'success');
    });

    this.configSection.appendChild(this.configForm);

    body.appendChild(speechSection);
    body.appendChild(aiSection);
    body.appendChild(status);
    body.appendChild(this.configSection);

    this.container.appendChild(header);
    this.container.appendChild(body);

    if (document.body) {
      document.body.appendChild(this.container);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(this.container);
      }, { once: true });
    }

    this.container.addEventListener('mousedown', (event) => {
      event.preventDefault();
    });

    this.renderPromptButtons(this.plugin.prompts);
    this.syncConfigForm(this.plugin.getAIConfig());
  }

  createLabeledInput(label, type, name) {
    const wrapper = document.createElement('label');
    wrapper.textContent = label;
    const input = document.createElement('input');
    input.type = type;
    input.name = name;
    input.autocomplete = 'off';
    wrapper.appendChild(input);
    return wrapper;
  }

  createLabeledTextarea(label, name) {
    const wrapper = document.createElement('label');
    wrapper.textContent = label;
    const input = document.createElement('textarea');
    input.name = name;
    wrapper.appendChild(input);
    return wrapper;
  }

  toggleConfig(force) {
    if (!this.configSection) return;
    const shouldOpen = typeof force === 'boolean' ? force : !this.configSection.classList.contains('open');
    if (shouldOpen) {
      this.syncConfigForm(this.plugin.getAIConfig());
      this.configSection.classList.add('open');
    } else {
      this.configSection.classList.remove('open');
    }
  }

  syncConfigForm(config) {
    if (!this.configForm) return;
    const endpoint = this.configForm.querySelector('input[name="endpoint"]');
    const apiKey = this.configForm.querySelector('input[name="apiKey"]');
    const model = this.configForm.querySelector('input[name="model"]');
    const systemPrompt = this.configForm.querySelector('textarea[name="systemPrompt"]');

    if (endpoint) endpoint.value = config.endpoint || '';
    if (apiKey) apiKey.value = config.apiKey || '';
    if (model) model.value = config.model || '';
    if (systemPrompt) systemPrompt.value = config.systemPrompt || '';
  }

  renderPromptButtons(prompts = []) {
    if (!this.promptButtonsWrapper) return;
    this.promptButtonsWrapper.innerHTML = '';
    if (!prompts.length) {
      const note = document.createElement('p');
      note.textContent = 'No AI actions configured.';
      note.style.fontSize = '0.8rem';
      note.style.color = '#475569';
      this.promptButtonsWrapper.appendChild(note);
      return;
    }

    prompts.forEach((prompt) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'voice-assist-plugin-button';
      button.textContent = prompt.label;
      button.dataset.promptId = prompt.id;
      button.addEventListener('click', () => {
        this.plugin.runAiAction(prompt);
      });
      this.promptButtonsWrapper.appendChild(button);
    });
  }

  show(targetElement) {
    if (!this.container || !targetElement) return;
    this.isVisible = true;
    this.container.style.display = 'block';
    this.positionRelativeTo(targetElement);
    if (typeof ResizeObserver === 'function' && !this.resizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.plugin.activeElement) {
          this.positionRelativeTo(this.plugin.activeElement);
        }
      });
    }
    if (this.resizeObserver && this.observedElement && this.observedElement !== targetElement) {
      try {
        this.resizeObserver.unobserve(this.observedElement);
      } catch (error) {
        // ignore detach errors
      }
    }
    if (this.resizeObserver) {
      this.resizeObserver.observe(targetElement);
      this.observedElement = targetElement;
    } else {
      this.observedElement = null;
    }
  }

  hide() {
    if (!this.container) return;
    this.isVisible = false;
    this.container.style.display = 'none';
    if (this.resizeObserver && this.observedElement) {
      try {
        this.resizeObserver.unobserve(this.observedElement);
      } catch (error) {
        // ignore when element already detached
      }
    }
    this.observedElement = null;
  }

  positionRelativeTo(targetElement) {
    if (!this.container || !targetElement) return;
    const rect = targetElement.getBoundingClientRect();
    const top = rect.bottom + window.scrollY + 8;
    let left = rect.left + window.scrollX;
    const containerWidth = this.container.offsetWidth;
    const viewportWidth = window.innerWidth;
    if (left + containerWidth > viewportWidth - 12) {
      left = viewportWidth - containerWidth - 12;
    }
    if (left < 12) left = 12;
    this.container.style.top = `${top}px`;
    this.container.style.left = `${left}px`;
  }

  setStatus(message, tone = 'neutral') {
    if (!this.statusNode) return;
    this.statusNode.textContent = message || '';
    this.statusNode.classList.remove('error', 'success');
    if (tone === 'error') {
      this.statusNode.classList.add('error');
    } else if (tone === 'success') {
      this.statusNode.classList.add('success');
    }
  }

  setSpeechCapturing(active) {
    if (!this.speechButton || !this.speechStopButton) return;
    if (!this.speechSupported) {
      this.speechButton.disabled = true;
      this.speechStopButton.disabled = true;
      return;
    }
    this.speechButton.disabled = active;
    this.speechStopButton.disabled = !active;
    if (active) {
      this.speechButton.textContent = '🎤 Listening…';
    } else {
      this.speechButton.textContent = '🎤 Start speaking';
    }
  }

  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.statusNode = null;
    this.promptButtonsWrapper = null;
    this.configSection = null;
    this.configForm = null;
    if (this.resizeObserver && this.observedElement) {
      try {
        this.resizeObserver.unobserve(this.observedElement);
      } catch (error) {
        // ignore
      }
    }
    this.resizeObserver = null;
    this.observedElement = null;
  }
}

export class VoiceAssistPlugin {
  constructor(options = {}) {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw new Error('VoiceAssistPlugin must be used in a browser-like environment.');
    }
    this.options = options;
    this.prompts = Array.isArray(options.prompts) ? options.prompts : DEFAULT_PROMPTS.slice();
    this.aiConfig = { ...DEFAULT_AI_CONFIG, ...(options.aiConfig || {}) };
    const defaultSpeechConfig = {
      locale: 'en-US',
      interimResults: false,
      insertionMode: 'append'
    };
    this.speechConfig = mergeSpeechConfig(defaultSpeechConfig, options.speechConfig);
    this.aiInsertionMode = options.aiInsertionMode || 'replace-selection';
    this.activeElement = null;
    this.ui = null;
    this.root = options.root || document;
    this.autoAttach = options.autoAttach !== false;
    this.isListening = false;
    this.recognition = null;
    this.pendingAiAbortController = null;
    this.isAttached = false;

    this.onFocusIn = this.onFocusIn.bind(this);
    this.onFocusOut = this.onFocusOut.bind(this);
    this.onWindowChange = this.onWindowChange.bind(this);
    this.onDocumentClick = this.onDocumentClick.bind(this);

    if (this.autoAttach) {
      this.attach();
    }
  }

  attach() {
    if (this.isAttached) return;
    this.root.addEventListener('focusin', this.onFocusIn);
    this.root.addEventListener('focusout', this.onFocusOut);
    window.addEventListener('resize', this.onWindowChange);
    document.addEventListener('scroll', this.onWindowChange, true);
    document.addEventListener('click', this.onDocumentClick);
    this.isAttached = true;
  }

  detach() {
    if (!this.isAttached) return;
    this.root.removeEventListener('focusin', this.onFocusIn);
    this.root.removeEventListener('focusout', this.onFocusOut);
    window.removeEventListener('resize', this.onWindowChange);
    document.removeEventListener('scroll', this.onWindowChange, true);
    document.removeEventListener('click', this.onDocumentClick);
    this.isAttached = false;
  }

  destroy() {
    this.detach();
    this.stopSpeechCapture();
    if (this.pendingAiAbortController) {
      this.pendingAiAbortController.abort();
      this.pendingAiAbortController = null;
    }
    if (this.ui) {
      this.ui.destroy();
      this.ui = null;
    }
    this.activeElement = null;
  }

  ensureUI() {
    if (!this.ui) {
      this.ui = new AssistUI(this);
    }
    return this.ui;
  }

  onFocusIn(event) {
    const target = event.target;
    if (!isTextLikeElement(target)) {
      return;
    }
    this.activeElement = target;
    this.ensureUI().show(target);
    this.ensureUI().setStatus('');
  }

  onFocusOut(event) {
    const nextFocus = event.relatedTarget;
    if (nextFocus && this.ui && this.ui.container && this.ui.container.contains(nextFocus)) {
      return;
    }
    setTimeout(() => {
      const active = document.activeElement;
      if (this.ui && (!active || !this.ui.container.contains(active)) && active !== this.activeElement) {
        this.ui.hide();
      }
    }, 150);
  }

  onWindowChange() {
    if (this.ui && this.ui.isVisible && this.activeElement) {
      this.ui.positionRelativeTo(this.activeElement);
    }
  }

  onDocumentClick(event) {
    if (!this.ui || !this.ui.container) return;
    if (!this.ui.isVisible) return;
    if (this.ui.container.contains(event.target)) return;
    if (this.activeElement && this.activeElement.contains && this.activeElement.contains(event.target)) return;
    this.ui.hide();
  }

  startSpeechCapture() {
    if (!this.activeElement) {
      this.ensureUI().setStatus('Focus a text input before starting speech capture.', 'error');
      return;
    }
    if (this.isListening) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.ensureUI().setStatus('Speech recognition is not supported in this browser.', 'error');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = this.speechConfig.locale || 'en-US';
    this.recognition.interimResults = Boolean(this.speechConfig.interimResults);
    this.recognition.continuous = false;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.ensureUI().setSpeechCapturing(true);
      this.ensureUI().setStatus('Listening…');
    };

    this.recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();
      if (!transcript) {
        this.ensureUI().setStatus('No speech detected. Try again.');
        return;
      }
      const mode = normalizeInsertionMode(this.speechConfig.insertionMode, 'append');
      if (mode === 'replace-selection') {
        replaceSelection(this.activeElement, transcript);
      } else if (mode === 'replace-all') {
        replaceAllText(this.activeElement, transcript);
      } else {
        appendText(this.activeElement, ` ${transcript}`.trimStart());
      }
      this.ensureUI().setStatus('Transcription inserted.', 'success');
    };

    this.recognition.onerror = (event) => {
      this.ensureUI().setStatus(`Speech error: ${event.error || 'unknown error'}`, 'error');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.ensureUI().setSpeechCapturing(false);
    };

    try {
      this.recognition.start();
    } catch (error) {
      this.isListening = false;
      this.ensureUI().setSpeechCapturing(false);
      this.ensureUI().setStatus(`Unable to start speech recognition: ${error.message}`, 'error');
    }
  }

  stopSpeechCapture() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (error) {
        this.ensureUI().setStatus(`Unable to stop speech recognition: ${error.message}`, 'error');
      }
    }
  }

  getAIConfig() {
    return { ...this.aiConfig };
  }

  setAIConfig(nextConfig = {}) {
    this.aiConfig = { ...this.aiConfig, ...nextConfig };
    if (this.ui) {
      this.ui.syncConfigForm(this.aiConfig);
    }
  }

  getSpeechConfig() {
    return { ...this.speechConfig };
  }

  setSpeechConfig(nextConfig = {}) {
    this.speechConfig = mergeSpeechConfig(this.speechConfig, nextConfig);
  }

  setAiInsertionMode(mode = 'replace-selection') {
    if (!VALID_INSERTION_MODES.includes(mode)) {
      throw new Error('aiInsertionMode must be one of: append, replace-selection, replace-all');
    }
    this.aiInsertionMode = mode;
  }

  getAiInsertionMode() {
    return this.aiInsertionMode;
  }

  setPrompts(prompts = []) {
    this.prompts = prompts.slice();
    if (this.ui) {
      this.ui.renderPromptButtons(this.prompts);
    }
  }

  async runAiAction(prompt) {
    if (!this.activeElement) {
      this.ensureUI().setStatus('Select a text input to use AI actions.', 'error');
      return;
    }

    if (this.pendingAiAbortController) {
      this.pendingAiAbortController.abort();
      this.pendingAiAbortController = null;
    }

    const selection = getActiveSelection(this.activeElement);
    const baseValue = typeof this.activeElement.value === 'string'
      ? this.activeElement.value
      : (this.activeElement.innerText ?? this.activeElement.textContent ?? '');
    const textTarget = selection.text || baseValue;
    const normalizedText = (textTarget || '').trim();

    if (!normalizedText) {
      this.ensureUI().setStatus('There is no text to send to the AI yet.', 'error');
      return;
    }

    this.ensureUI().setStatus(`Running “${prompt.label}”…`);

    const controller = new AbortController();
    this.pendingAiAbortController = controller;

    try {
      const requestHandler = typeof this.options.aiRequest === 'function' ? this.options.aiRequest : defaultAiRequest;
      const aiResponse = await requestHandler({
        text: normalizedText,
        instruction: prompt.instruction,
        config: this.aiConfig,
        signal: controller.signal,
        prompt
      });

      if (selection.text) {
        replaceSelection(this.activeElement, aiResponse);
      } else if (this.aiInsertionMode === 'replace-all') {
        replaceAllText(this.activeElement, aiResponse);
      } else {
        appendText(this.activeElement, ` ${aiResponse}`.trimStart());
      }

      this.ensureUI().setStatus(`${prompt.label} applied.`, 'success');
    } catch (error) {
      if (controller.signal.aborted) {
        this.ensureUI().setStatus('AI request cancelled.', 'error');
      } else {
        this.ensureUI().setStatus(error.message, 'error');
      }
    } finally {
      if (this.pendingAiAbortController === controller) {
        this.pendingAiAbortController = null;
      }
    }
  }
}

export default VoiceAssistPlugin;
export { DEFAULT_PROMPTS, DEFAULT_AI_CONFIG, defaultAiRequest };
