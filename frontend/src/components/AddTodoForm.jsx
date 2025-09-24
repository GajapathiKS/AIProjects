import { useState } from 'react';

export function AddTodoForm({ onAdd }) {
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Title is required');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onAdd(trimmed);
      setTitle('');
    } catch {
      setError('Unable to add todo. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
      <div className="flex-1">
        <label htmlFor="title" className="sr-only">
          Todo title
        </label>
        <input
          id="title"
          type="text"
          className="w-full rounded-md border border-slate-700 bg-slate-800 p-3 text-slate-100 focus:border-indigo-500 focus:outline-none"
          placeholder="What needs to be done?"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={submitting}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'todo-error' : undefined}
        />
        {error && (
          <p id="todo-error" className="mt-1 text-sm text-rose-400" role="alert">
            {error}
          </p>
        )}
      </div>
      <button
        type="submit"
        className="rounded-md bg-indigo-500 px-4 py-3 font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-300"
        disabled={submitting}
      >
        {submitting ? 'Adding…' : 'Add'}
      </button>
    </form>
  );
}
