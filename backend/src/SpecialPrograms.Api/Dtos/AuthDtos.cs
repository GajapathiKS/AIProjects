namespace SpecialPrograms.Api.Dtos;

public record LoginRequest(string Username, string Password);

public record AuthResponse(string Token, string Username, string Role);
