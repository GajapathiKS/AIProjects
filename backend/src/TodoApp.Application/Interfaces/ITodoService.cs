using TodoApp.Application.Models;

namespace TodoApp.Application.Interfaces;

public interface ITodoService
{
    Task<TodoItemDto> AddTodoAsync(string title, CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<TodoItemDto>> GetTodosAsync(CancellationToken cancellationToken = default);
    Task<TodoItemDto?> MarkCompletedAsync(Guid id, bool isCompleted = true, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
