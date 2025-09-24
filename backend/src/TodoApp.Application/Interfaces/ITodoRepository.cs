using TodoApp.Domain.Entities;

namespace TodoApp.Application.Interfaces;

public interface ITodoRepository
{
    Task<TodoItem> AddAsync(TodoItem todo, CancellationToken cancellationToken = default);
    Task<List<TodoItem>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<TodoItem?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task UpdateAsync(TodoItem todo, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
