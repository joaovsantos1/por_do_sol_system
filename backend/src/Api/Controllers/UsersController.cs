using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdv.Application.Auth;
using Pdv.Domain.Entities;
using Pdv.Domain.Enums;
using Pdv.Infrastructure.Data;

namespace Pdv.Api.Controllers;

public record CriarUsuarioRequest(string Nome, string Login, string Senha, string Perfil);
public record EditarUsuarioRequest(string Nome, string Perfil);
public record TrocarSenhaRequest(string NovaSenha);

/// <summary>
/// CRUD de usuários. Restrito ao Administrador — mudar perfil/senha de
/// outra pessoa é uma operação sensível e não deve ficar disponível para
/// Gerente/Caixa/Operador.
/// </summary>
[ApiController]
[Route("api/users")]
[Authorize(Roles = "Administrador")]
public class UsersController : ControllerBase
{
    private readonly PdvDbContext _db;
    public UsersController(PdvDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Listar(CancellationToken ct)
    {
        var usuarios = await _db.Usuarios.AsNoTracking()
            .OrderBy(u => u.Nome)
            .Select(u => new
            {
                u.Id, u.Nome, u.Login, Perfil = u.Perfil.ToString(), u.Ativo, u.UltimoAcesso
            })
            .ToListAsync(ct);
        return Ok(usuarios);
    }

    [HttpPost]
    public async Task<IActionResult> Criar(CriarUsuarioRequest request, CancellationToken ct)
    {
        if (await _db.Usuarios.AnyAsync(u => u.Login == request.Login, ct))
            return Conflict(new { erro = "Já existe um usuário com este login." });

        var usuario = new Usuario
        {
            Nome = request.Nome,
            Login = request.Login,
            SenhaHash = AuthService.HashSenha(request.Senha),
            Perfil = Enum.Parse<PerfilUsuario>(request.Perfil, true),
            Ativo = true
        };
        _db.Usuarios.Add(usuario);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(Listar), new { }, new { usuario.Id });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Editar(Guid id, EditarUsuarioRequest request, CancellationToken ct)
    {
        var usuario = await _db.Usuarios.FindAsync([id], ct);
        if (usuario is null) return NotFound();

        usuario.Nome = request.Nome;
        usuario.Perfil = Enum.Parse<PerfilUsuario>(request.Perfil, true);
        usuario.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPatch("{id:guid}/senha")]
    public async Task<IActionResult> TrocarSenha(Guid id, TrocarSenhaRequest request, CancellationToken ct)
    {
        var usuario = await _db.Usuarios.FindAsync([id], ct);
        if (usuario is null) return NotFound();

        usuario.SenhaHash = AuthService.HashSenha(request.NovaSenha);
        usuario.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPatch("{id:guid}/inativar")]
    public async Task<IActionResult> Inativar(Guid id, CancellationToken ct)
    {
        var usuario = await _db.Usuarios.FindAsync([id], ct);
        if (usuario is null) return NotFound();
        usuario.Ativo = false;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPatch("{id:guid}/ativar")]
    public async Task<IActionResult> Ativar(Guid id, CancellationToken ct)
    {
        var usuario = await _db.Usuarios.FindAsync([id], ct);
        if (usuario is null) return NotFound();
        usuario.Ativo = true;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
