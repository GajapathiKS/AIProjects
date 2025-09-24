import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL
});

export function useTodos() {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTodos = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/todos');
      setTodos(response.data);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const addTodo = useCallback(
    async (title) => {
      try {
        const response = await api.post('/api/todos', { title });
        setTodos((prev) => [...prev, response.data]);
        setError(null);
      } catch (err) {
        setError(err);
        throw err;
      }
    },
    []
  );

  const toggleTodo = useCallback(async (id, isCompleted) => {
    try {
      const response = await api.patch(`/api/todos/${id}/complete`, { isCompleted });
      setTodos((prev) => prev.map((todo) => (todo.id === id ? response.data : todo)));
      setError(null);
    } catch (err) {
      setError(err);
      throw err;
    }
  }, []);

  const deleteTodo = useCallback(async (id) => {
    try {
      await api.delete(`/api/todos/${id}`);
      setTodos((prev) => prev.filter((todo) => todo.id !== id));
      setError(null);
    } catch (err) {
      setError(err);
      throw err;
    }
  }, []);

  return {
    todos,
    loading,
    error,
    addTodo,
    toggleTodo,
    deleteTodo,
    refetch: fetchTodos
  };
}
