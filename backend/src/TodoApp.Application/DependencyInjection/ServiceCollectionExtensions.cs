using Microsoft.Extensions.DependencyInjection;
using TodoApp.Application.Interfaces;
using TodoApp.Application.Services;

namespace TodoApp.Application.DependencyInjection;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<ITodoService, TodoService>();
        return services;
    }
}
