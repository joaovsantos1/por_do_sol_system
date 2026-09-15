using Microsoft.AspNetCore.Mvc;
using Pdv.Application.Auth;

namespace Pdv.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AuthService _auth;

    public AuthController(AuthService auth) => _auth = auth;

    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _auth.LoginAsync(request.Login, request.Senha, ct);
            return Ok(result);
        }
        catch (CredenciaisInvalidasException ex)
        {
            return Unauthorized(new { erro = ex.Message });
        }
    }
}
