using TodoApp.Application.DependencyInjection;
using TodoApp.Application.Interfaces;
using TodoApp.Infrastructure.DependencyInjection;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();
app.UseCors("AllowAll");

var todoApi = app.MapGroup("/api/todos");

todoApi.MapGet("/", async (ITodoService service, CancellationToken cancellationToken) =>
{
    var todos = await service.GetTodosAsync(cancellationToken);
    return Results.Ok(todos);
});

todoApi.MapPost("/", async (TodoCreateRequest request, ITodoService service, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Title))
    {
        return Results.BadRequest(new { Message = "Title is required" });
    }

    var todo = await service.AddTodoAsync(request.Title, cancellationToken);
    return Results.Created($"/api/todos/{todo.Id}", todo);
});

todoApi.MapPatch("/{id:guid}/complete", async (Guid id, TodoCompletionRequest request, ITodoService service, CancellationToken cancellationToken) =>
{
    var todo = await service.MarkCompletedAsync(id, request?.IsCompleted ?? true, cancellationToken);
    return todo is null ? Results.NotFound() : Results.Ok(todo);
});

todoApi.MapDelete("/{id:guid}", async (Guid id, ITodoService service, CancellationToken cancellationToken) =>
{
    var deleted = await service.DeleteAsync(id, cancellationToken);
    return deleted ? Results.NoContent() : Results.NotFound();
});

app.MapGet("/", () => Results.Ok("Todo API is running"));

app.Run();

internal record TodoCreateRequest(string Title);

internal record TodoCompletionRequest(bool IsCompleted = true);
