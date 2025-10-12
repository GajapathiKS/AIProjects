using Microsoft.AspNetCore.Mvc;
using SpecialPrograms.Api.Dtos;
using SpecialPrograms.Api.Services;

namespace SpecialPrograms.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(IAuthService authService) : ControllerBase
{
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        var result = await authService.LoginAsync(request);
        if (result is null)
        {
            return Unauthorized();
        }

        return Ok(result);
    }
}
