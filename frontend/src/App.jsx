import { AddTodoForm } from './components/AddTodoForm.jsx';
import { TodoList } from './components/TodoList.jsx';
import { useTodos } from './hooks/useTodos.js';

function App() {
  const { todos, loading, error, addTodo, toggleTodo, deleteTodo } = useTodos();

  const handleToggle = async (id, isCompleted) => {
    await toggleTodo(id, isCompleted);
  };

  const errorMessage = error
    ? error.response?.data?.message ?? error.message ?? 'An unexpected error occurred.'
    : '';

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-slate-100">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="text-center">
          <h1 className="text-3xl font-bold">Todo Application</h1>
          <p className="mt-2 text-sm text-slate-400">
            Add tasks, mark them as complete, and stay organised.
          </p>
        </header>

        <AddTodoForm onAdd={addTodo} />

        {loading && <p className="text-sm text-slate-400">Loading todos…</p>}
        {errorMessage && !loading && (
          <p className="rounded-md border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-200" role="alert">
            {errorMessage}
          </p>
        )}

        {!loading && (
          <TodoList todos={todos} onToggle={handleToggle} onDelete={deleteTodo} />
        )}
      </div>
    </div>
  );
}

export default App;
