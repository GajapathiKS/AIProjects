namespace TodoApp.Application.Models;

public sealed record TodoItemDto(Guid Id, string Title, bool IsCompleted);
