import { useEffect, useState } from 'react';
import VoiceAssistPlugin from 'voice-assist-plugin';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const plugin = new VoiceAssistPlugin({
      aiConfig: {
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: '',
        model: 'gpt-4o-mini'
      },
      speechConfig: {
        locale: 'en-US',
        insertionMode: 'replace-selection'
      }
    });

    setReady(true);

    return () => {
      plugin.destroy();
      setReady(false);
    };
  }, []);

  return (
    <main className="app-shell">
      <section className="hero">
        <h1>React + Voice Assist Plugin</h1>
        <p>
          Focus the textarea below to open the floating assistant. Use the microphone button for
          speech-to-text and the action chips for quick AI rewrites. Click the gear icon to provide
          your API key or swap models.
        </p>
      </section>

      <label className="input-block" htmlFor="demo-textarea">
        <span>Try it out</span>
        <textarea
          id="demo-textarea"
          placeholder="Place your cursor here and trigger the assistant."
          rows={8}
        />
      </label>

      <p className="status" role="status">
        {ready
          ? 'Assistant ready — focus any supported text input to use it.'
          : 'Initialising assistant…'}
      </p>
    </main>
  );
}
