using Microsoft.EntityFrameworkCore;
using TodoApp.Application.Interfaces;
using TodoApp.Domain.Entities;
using TodoApp.Infrastructure.Persistence;

namespace TodoApp.Infrastructure.Repositories;

public class TodoRepository : ITodoRepository
{
    private readonly TodoDbContext _context;

    public TodoRepository(TodoDbContext context)
    {
        _context = context;
    }

    public async Task<TodoItem> AddAsync(TodoItem todo, CancellationToken cancellationToken = default)
    {
        await _context.TodoItems.AddAsync(todo, cancellationToken);
        return todo;
    }

    public Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return _context.TodoItems.Where(t => t.Id == id).ExecuteDeleteAsync(cancellationToken);
    }

    public Task<List<TodoItem>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return _context.TodoItems.OrderBy(t => t.IsCompleted).ThenBy(t => t.Title).ToListAsync(cancellationToken);
    }

    public Task<TodoItem?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return _context.TodoItems.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
    }

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        return _context.SaveChangesAsync(cancellationToken);
    }

    public Task UpdateAsync(TodoItem todo, CancellationToken cancellationToken = default)
    {
        _context.TodoItems.Update(todo);
        return Task.CompletedTask;
    }
}
