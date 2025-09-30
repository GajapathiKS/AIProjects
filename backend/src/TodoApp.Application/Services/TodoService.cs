using TodoApp.Application.Interfaces;
using TodoApp.Application.Models;
using TodoApp.Domain.Entities;

namespace TodoApp.Application.Services;

public class TodoService : ITodoService
{
    private readonly ITodoRepository _repository;

    public TodoService(ITodoRepository repository)
    {
        _repository = repository;
    }

    public async Task<TodoItemDto> AddTodoAsync(string title, CancellationToken cancellationToken = default)
    {
        var todo = new TodoItem(title);
        await _repository.AddAsync(todo, cancellationToken);
        await _repository.SaveChangesAsync(cancellationToken);
        return todo.ToDto();
    }

    public async Task<IReadOnlyCollection<TodoItemDto>> GetTodosAsync(CancellationToken cancellationToken = default)
    {
        var todos = await _repository.GetAllAsync(cancellationToken);
        return todos.Select(t => t.ToDto()).ToList();
    }

    public async Task<TodoItemDto?> MarkCompletedAsync(Guid id, bool isCompleted = true, CancellationToken cancellationToken = default)
    {
        var todo = await _repository.GetByIdAsync(id, cancellationToken);
        if (todo is null)
        {
            return null;
        }

        todo.SetCompletionStatus(isCompleted);
        await _repository.UpdateAsync(todo, cancellationToken);
        await _repository.SaveChangesAsync(cancellationToken);
        return todo.ToDto();
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var existing = await _repository.GetByIdAsync(id, cancellationToken);
        if (existing is null)
        {
            return false;
        }

        await _repository.DeleteAsync(id, cancellationToken);
        await _repository.SaveChangesAsync(cancellationToken);
        return true;
    }
}

internal static class TodoMappings
{
    public static TodoItemDto ToDto(this TodoItem todo)
        => new(todo.Id, todo.Title, todo.IsCompleted);
}
