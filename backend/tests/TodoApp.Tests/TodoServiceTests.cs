using Microsoft.EntityFrameworkCore;
using TodoApp.Application.Interfaces;
using TodoApp.Application.Services;
using TodoApp.Infrastructure.Persistence;
using TodoApp.Infrastructure.Repositories;
using Xunit;

namespace TodoApp.Tests;

public class TodoServiceTests
{
    private static (ITodoService Service, TodoDbContext Context) CreateService()
    {
        var options = new DbContextOptionsBuilder<TodoDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var context = new TodoDbContext(options);
        ITodoRepository repository = new TodoRepository(context);
        ITodoService service = new TodoService(repository);
        return (service, context);
    }

    [Fact]
    public async Task AddTodoAsync_PersistsTodo()
    {
        var (service, context) = CreateService();

        var result = await service.AddTodoAsync("Write tests");

        var stored = await context.TodoItems.SingleAsync();
        Assert.Equal(result.Id, stored.Id);
        Assert.Equal("Write tests", stored.Title);
        Assert.False(stored.IsCompleted);
    }

    [Fact]
    public async Task MarkCompletedAsync_UpdatesTodo()
    {
        var (service, context) = CreateService();
        var todo = await service.AddTodoAsync("Ship feature");

        var updated = await service.MarkCompletedAsync(todo.Id);

        Assert.NotNull(updated);
        Assert.True(updated!.IsCompleted);

        var stored = await context.TodoItems.SingleAsync();
        Assert.True(stored.IsCompleted);
    }
}
