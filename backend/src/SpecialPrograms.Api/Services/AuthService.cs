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

    public AuthService(
        ApplicationDbContext context,
        IOptions<SeedUserOptions> seedUser,
        IConfiguration configuration)
    {
        _context = context;
        _seedUser = seedUser.Value;
        _configuration = configuration;
    }

    public async Task<AuthResponse?> LoginAsync(LoginRequest request)
    {
        var user = await _context.Users.SingleOrDefaultAsync(u => u.Username == request.Username);
        if (user is null)
        {
            return null;
        }

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            return null;
        }

        var token = CreateToken(user);
        return new AuthResponse(token, user.Username, user.Role);
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
