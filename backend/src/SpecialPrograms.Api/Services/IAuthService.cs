using SpecialPrograms.Api.Dtos;

namespace SpecialPrograms.Api.Services;

public record SeedUserOptions
{
    public string Username { get; init; } = "admin";
    public string Password { get; init; } = "P@ssword1";
}

public interface IAuthService
{
    Task<AuthResponse?> LoginAsync(LoginRequest request);
    Task EnsureSeedUserAsync();
}
