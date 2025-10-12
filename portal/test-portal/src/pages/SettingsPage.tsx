import { FormEvent, useState } from 'react';
import { ApiClient } from '../api/client';
import { useAsync } from '../hooks/useAsync';

const environmentTypes = ['Dev', 'QA', 'Prod'];
const authTypes = [
  { label: 'No auth', value: 'none' },
  { label: 'Bearer token', value: 'token' },
  { label: 'Basic auth', value: 'basic' }
];

export default function SettingsPage() {
  const environments = useAsync(ApiClient.listEnvironments, []);
  const [form, setForm] = useState({
    name: '',
    type: 'Dev',
    baseUrl: 'http://localhost:5140',
    authType: 'none',
    authToken: '',
    username: '',
    password: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    ApiClient.createEnvironment({
      name: form.name,
      type: form.type,
      baseUrl: form.baseUrl,
      authType: form.authType as 'none' | 'token' | 'basic',
      authToken: form.authType === 'token' ? form.authToken : undefined,
      username: form.authType === 'basic' ? form.username : undefined,
      password: form.authType === 'basic' ? form.password : undefined,
      notes: form.notes || undefined
    }).then(() => {
      setForm({ name: '', type: form.type, baseUrl: form.baseUrl, authType: form.authType, authToken: '', username: '', password: '', notes: '' });
      environments.refresh();
    }).finally(() => setSaving(false));
  };

  return (
    <div className="settings">
      <section>
        <h2>Add Environment</h2>
        <form onSubmit={submit} className="panel">
          <label>Name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
          <label>
            Type
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              {environmentTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>Base URL<input value={form.baseUrl} onChange={e => setForm({ ...form, baseUrl: e.target.value })} /></label>
          <label>
            Auth Strategy
            <select value={form.authType} onChange={e => setForm({ ...form, authType: e.target.value })}>
              {authTypes.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          {form.authType === 'token' && (
            <label>Bearer Token<input value={form.authToken} onChange={e => setForm({ ...form, authToken: e.target.value })} /></label>
          )}
          {form.authType === 'basic' && (
            <>
              <label>Username<input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></label>
              <label>Password<input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
            </>
          )}
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
                <small>Auth: {env.authType === 'none' ? 'None' : env.authType}</small>
                {env.notes && <p>{env.notes}</p>}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
