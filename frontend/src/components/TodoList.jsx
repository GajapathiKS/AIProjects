export function TodoList({ todos, onToggle, onDelete }) {
  if (!todos.length) {
    return (
      <p className="mt-6 text-center text-sm text-slate-400">
        You have nothing to do yet. Add your first task!
      </p>
    );
  }

  return (
    <ul className="mt-6 space-y-3">
      {todos.map((todo) => (
        <li key={todo.id} className="flex items-center gap-3 rounded-md bg-slate-800 px-4 py-3 shadow">
          <input
            id={`todo-${todo.id}`}
            type="checkbox"
            className="h-5 w-5 rounded border-slate-600 text-indigo-500 focus:ring-indigo-400"
            checked={todo.isCompleted}
            onChange={(event) => onToggle(todo.id, event.target.checked)}
          />
          <label
            htmlFor={`todo-${todo.id}`}
            className={`flex-1 text-lg ${todo.isCompleted ? 'text-slate-400 line-through' : 'text-slate-100'}`}
          >
            {todo.title}
          </label>
          <button
            type="button"
            onClick={() => onDelete(todo.id)}
            className="rounded-md border border-transparent px-3 py-1 text-sm font-semibold text-rose-300 transition hover:border-rose-400 hover:text-rose-200"
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
