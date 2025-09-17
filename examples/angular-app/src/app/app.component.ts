import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import VoiceAssistPlugin from 'voice-assist-plugin';

@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <main class="shell">
      <section class="intro">
        <h1>Angular + Voice Assist Plugin</h1>
        <p>
          Focus the textarea and the floating assistant will appear next to it. Start a speech capture
          session or trigger one of the AI prompts, then insert the result right back into the editor.
          Use the gear icon to configure your endpoint, API key, or switch models at runtime.
        </p>
      </section>

      <label class="input-block" for="angular-textarea">
        <span>Give it a spin</span>
        <textarea
          id="angular-textarea"
          rows="8"
          placeholder="Place the caret here to summon the assistant overlay."
        ></textarea>
      </label>

      <p class="status" [attr.aria-live]="'polite'">
        {{ ready ? 'Assistant ready — focus a supported text field to try it out.' : 'Initialising assistant…' }}
      </p>
    </main>
  `,
  styles: [
    `
      :host {
        display: flex;
        min-height: 100vh;
        padding: 3rem 1.5rem;
        justify-content: center;
        align-items: center;
      }

      .shell {
        width: min(720px, 96vw);
        background: #ffffff;
        border-radius: 24px;
        padding: 3rem;
        box-shadow: 0 40px 90px rgba(15, 23, 42, 0.15);
        display: flex;
        flex-direction: column;
        gap: 1.75rem;
      }

      .intro h1 {
        margin: 0 0 0.5rem;
        font-size: clamp(1.75rem, 4vw, 2.5rem);
      }

      .intro p {
        margin: 0;
        color: #475569;
        font-size: 1rem;
        line-height: 1.6;
      }

      .input-block {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        font-size: 0.95rem;
      }

      .input-block textarea {
        border-radius: 16px;
        border: 1px solid #cbd5f5;
        padding: 1rem 1.25rem;
        font: inherit;
        line-height: 1.6;
        min-height: 200px;
        resize: vertical;
        background: #f8fafc;
      }

      .status {
        margin: 0;
        font-size: 0.9rem;
        color: #64748b;
      }

      @media (max-width: 640px) {
        :host {
          padding: 2rem 1rem;
        }

        .shell {
          padding: 2rem 1.5rem;
        }
      }
    `
  ]
})
export class AppComponent implements AfterViewInit, OnDestroy {
  ready = false;
  private plugin?: VoiceAssistPlugin;

  ngAfterViewInit(): void {
    this.plugin = new VoiceAssistPlugin({
      aiConfig: {
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: '',
        model: 'gpt-4o-mini'
      },
      speechConfig: {
        locale: 'en-US',
        insertionMode: 'append'
      }
    });

    this.ready = true;
  }

  ngOnDestroy(): void {
    this.plugin?.destroy();
    this.ready = false;
  }
}
