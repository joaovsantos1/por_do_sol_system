using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Pdv.Domain.Entities;
using Pdv.Infrastructure.Data;

namespace Pdv.Application.Auth;

public class JwtOptions
{
    public string Secret { get; set; } = default!;
    public string Issuer { get; set; } = default!;
    public string Audience { get; set; } = default!;
    public int ExpirationMinutes { get; set; } = 60;
}

public record LoginRequest(string Login, string Senha);
public record LoginResponse(string Token, string Nome, string Perfil, DateTime ExpiraEm);

public class CredenciaisInvalidasException : Exception
{
    public CredenciaisInvalidasException() : base("Login ou senha inválidos.") { }
}

public class AuthService
{
    private readonly PdvDbContext _db;
    private readonly JwtOptions _jwt;

    public AuthService(PdvDbContext db, IOptions<JwtOptions> jwt)
    {
        _db = db;
        _jwt = jwt.Value;
    }

    public async Task<LoginResponse> LoginAsync(string login, string senha, CancellationToken ct = default)
    {
        var usuario = await _db.Usuarios.SingleOrDefaultAsync(u => u.Login == login && u.Ativo, ct);
        if (usuario is null || !BCrypt.Net.BCrypt.Verify(senha, usuario.SenhaHash))
            throw new CredenciaisInvalidasException();

        usuario.UltimoAcesso = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        var expira = DateTime.UtcNow.AddMinutes(_jwt.ExpirationMinutes);
        var token = GerarToken(usuario, expira);

        return new LoginResponse(token, usuario.Nome, usuario.Perfil.ToString(), expira);
    }

    private string GerarToken(Usuario usuario, DateTime expira)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, usuario.Id.ToString()),
            new(ClaimTypes.NameIdentifier, usuario.Id.ToString()),
            new(ClaimTypes.Name, usuario.Nome),
            new(ClaimTypes.Role, usuario.Perfil.ToString()),
            new("login", usuario.Login)
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _jwt.Issuer,
            audience: _jwt.Audience,
            claims: claims,
            expires: expira,
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public static string HashSenha(string senha) => BCrypt.Net.BCrypt.HashPassword(senha);
}
