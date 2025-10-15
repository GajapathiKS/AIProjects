import { FormEvent, useState } from 'react';
import { ApiClient } from '../api/client';
import { useAsync } from '../hooks/useAsync';

const environmentTypes = ['Dev', 'QA', 'Staging', 'Prod'];

export default function SettingsPage() {
  const environments = useAsync(ApiClient.listEnvironments, []);
  const [form, setForm] = useState({
    name: '',
    type: 'Dev',
    baseUrl: 'http://localhost:5140',
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.name || !form.baseUrl) return;
    setSaving(true);
    ApiClient.createEnvironment({
      name: form.name,
      type: form.type,
      baseUrl: form.baseUrl,
      notes: form.notes || undefined
    }).then(() => {
      setForm({ name: '', type: form.type, baseUrl: form.baseUrl, notes: '' });
      environments.refresh();
    }).finally(() => setSaving(false));
  };

  return (
    <div className="settings">
      <section>
        <h2>Add Environment</h2>
        <form onSubmit={submit} className="panel">
          <label>Name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="QA" /></label>
          <label>
            Type
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              {environmentTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>Base URL<input value={form.baseUrl} onChange={e => setForm({ ...form, baseUrl: e.target.value })} /></label>
          <label>Notes<textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} /></label>
          <button type="submit" disabled={saving}>Save Environment</button>
        </form>
      </section>
      <section>
        <h2>Configured Environments</h2>
        <div className="panel">
          <ul>
            {(environments.value ?? []).map(env => (
              <li key={env.id}>
                <strong>{env.name}</strong>
                <span>{env.type} · {env.baseUrl}</span>
                {env.notes && <p>{env.notes}</p>}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
