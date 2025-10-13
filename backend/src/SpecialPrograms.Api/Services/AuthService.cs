using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using SpecialPrograms.Api.Data;
using SpecialPrograms.Api.Dtos;
using SpecialPrograms.Api.Models;

namespace SpecialPrograms.Api.Services;

public class AuthService : IAuthService
{
    private readonly ApplicationDbContext _context;
    private readonly SeedUserOptions _seedUser;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        ApplicationDbContext context,
        IOptions<SeedUserOptions> seedUser,
        IConfiguration configuration,
        ILogger<AuthService> logger)
    {
        _context = context;
        _seedUser = seedUser.Value;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<AuthResponse?> LoginAsync(LoginRequest request)
    {
        try
        {
            _logger.LogInformation("Login attempt for user {Username}", request.Username);
            var user = await _context.Users.SingleOrDefaultAsync(u => u.Username == request.Username);
            if (user is null)
            {
                _logger.LogWarning("Login failed: user {Username} not found", request.Username);
                return null;
            }

            var verified = false;
            try
            {
                verified = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error verifying password for user {Username}", request.Username);
                return null;
            }

            if (!verified)
            {
                _logger.LogWarning("Login failed: invalid password for user {Username}", request.Username);
                return null;
            }

            _logger.LogInformation("Login successful for user {Username}", request.Username);
            var token = CreateToken(user);
            return new AuthResponse(token, user.Username, user.Role);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during login for {Username}", request?.Username);
            throw;
        }
    }

    public async Task EnsureSeedUserAsync()
    {
        if (await _context.Users.AnyAsync())
        {
            return;
        }

        var admin = new UserAccount
        {
            Username = _seedUser.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(_seedUser.Password),
            Role = "Admin"
        };

        _context.Users.Add(admin);
        await _context.SaveChangesAsync();
    }

    private string CreateToken(UserAccount user)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Role, user.Role)
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(4),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
