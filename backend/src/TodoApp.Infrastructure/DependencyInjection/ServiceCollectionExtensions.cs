using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TodoApp.Application.Interfaces;
using TodoApp.Infrastructure.Persistence;
using TodoApp.Infrastructure.Repositories;

namespace TodoApp.Infrastructure.DependencyInjection;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' not found.");

        services.AddDbContext<TodoDbContext>(options =>
            options.UseNpgsql(connectionString));

        services.AddScoped<ITodoRepository, TodoRepository>();

        return services;
    }
}
