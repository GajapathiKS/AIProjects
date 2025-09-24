import { test, expect, request as playwrightRequest } from '@playwright/test';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:5000';

async function resetTodos() {
  const api = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
  const response = await api.get('/api/todos');
  const todos = await response.json();
  await Promise.all(todos.map((todo) => api.delete(`/api/todos/${todo.id}`)));
  await api.dispose();
}

test.describe('Todo application', () => {
  test.beforeEach(async () => {
    await resetTodos();
  });

  test('user can add, complete, and delete todos', async ({ page }) => {
    await page.goto('/');

    const todoTitle = 'Walk the dog';

    await page.getByPlaceholder('What needs to be done?').fill(todoTitle);
    await page.getByRole('button', { name: 'Add' }).click();

    const todoItem = page.getByRole('listitem').filter({ hasText: todoTitle });
    await expect(todoItem).toBeVisible();

    await expect.poll(async () => {
      const api = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
      const response = await api.get('/api/todos');
      const data = await response.json();
      await api.dispose();
      return data.length;
    }).toBe(1);

    const checkbox = page.getByRole('checkbox', { name: todoTitle });
    await checkbox.check();
    await expect(checkbox).toBeChecked();

    await expect.poll(async () => {
      const api = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
      const response = await api.get('/api/todos');
      const [item] = await response.json();
      await api.dispose();
      return item?.isCompleted;
    }).toBe(true);

    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();

    await expect.poll(async () => {
      const api = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
      const response = await api.get('/api/todos');
      const [item] = await response.json();
      await api.dispose();
      return item?.isCompleted;
    }).toBe(false);

    await todoItem.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('You have nothing to do yet. Add your first task!')).toBeVisible();

    await expect.poll(async () => {
      const api = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
      const response = await api.get('/api/todos');
      const data = await response.json();
      await api.dispose();
      return data.length;
    }).toBe(0);
  });
});
