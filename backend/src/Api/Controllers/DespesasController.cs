using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdv.Domain.Entities;
using Pdv.Infrastructure.Data;

namespace Pdv.Api.Controllers;

public record CategoriaDespesaRequest(string Nome);
public record DespesaRequest(string Descricao, decimal Valor, DateTime Data, Guid CategoriaDespesaId, string? Observacao);

[ApiController]
[Route("api/despesas/categorias")]
[Authorize(Roles = "Administrador,Gerente")]
public class CategoriasDespesaController : ControllerBase
{
    private readonly PdvDbContext _db;
    public CategoriasDespesaController(PdvDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Listar(CancellationToken ct) =>
        Ok(await _db.CategoriasDespesa.AsNoTracking().Where(c => c.Ativo).OrderBy(c => c.Nome)
            .Select(c => new { c.Id, c.Nome }).ToListAsync(ct));

    [HttpPost]
    public async Task<IActionResult> Criar(CategoriaDespesaRequest request, CancellationToken ct)
    {
        var categoria = new CategoriaDespesa { Nome = request.Nome };
        _db.CategoriasDespesa.Add(categoria);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(Listar), new { categoria.Id });
    }
}

[ApiController]
[Route("api/despesas")]
[Authorize(Roles = "Administrador,Gerente")]
public class DespesasController : ControllerBase
{
    private readonly PdvDbContext _db;
    public DespesasController(PdvDbContext db) => _db = db;

    private Guid UsuarioId => Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")!.Value);

    [HttpGet]
    public async Task<IActionResult> Listar([FromQuery] DateTime? inicio, [FromQuery] DateTime? fim, [FromQuery] Guid? categoriaId, CancellationToken ct)
    {
        var query = _db.Despesas.AsNoTracking().AsQueryable();
        if (inicio.HasValue)
        {
            var inicioUtc = DateRangeHelper.InicioUtc(inicio.Value);
            query = query.Where(d => d.Data >= inicioUtc);

        }
        if (fim.HasValue)
        {
            var fimExclusivoUtc = DateRangeHelper.FimExclusivoUtc(fim.Value);
            query = query.Where(d => d.Data < fimExclusivoUtc);
        }
        if (categoriaId.HasValue) query = query.Where(d => d.CategoriaDespesaId == categoriaId);

        var despesas = await query
            .Include(d => d.CategoriaDespesa)
            .Include(d => d.Usuario)
            .OrderByDescending(d => d.Data)
            .Select(d => new
            {
                d.Id,
                d.Descricao,
                d.Valor,
                d.Data,
                d.CategoriaDespesaId,
                Categoria = d.CategoriaDespesa!.Nome,
                Usuario = d.Usuario!.Nome,
                d.Observacao
            })
            .ToListAsync(ct);

        return Ok(despesas);
    }

    [HttpPost]
    public async Task<IActionResult> Criar(DespesaRequest request, CancellationToken ct)
    {
        var dataRecebida = DateTime.SpecifyKind(request.Data, DateTimeKind.Unspecified);
        var despesa = new Despesa
        {
            Descricao = request.Descricao,
            Valor = request.Valor,
            Data = DateRangeHelper.InicioUtc(request.Data),
            CategoriaDespesaId = request.CategoriaDespesaId,
            Observacao = request.Observacao,
            UsuarioId = UsuarioId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = null
        };
        _db.Despesas.Add(despesa);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(Listar), new { }, new { despesa.Id });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Editar(Guid id, DespesaRequest request, CancellationToken ct)
    {
        var despesa = await _db.Despesas.FindAsync([id], ct);
        if (despesa is null) return NotFound();

        despesa.Descricao = request.Descricao;
        despesa.Valor = request.Valor;
        despesa.Data = DateRangeHelper.InicioUtc(request.Data);
        despesa.CategoriaDespesaId = request.CategoriaDespesaId;
        despesa.Observacao = request.Observacao;
        despesa.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // Despesa é um lançamento manual do operador (não faz parte da trilha
    // fiscal de vendas/estoque), então diferente de Venda/Comanda, aqui a
    // exclusão física é aceitável — corrige um lançamento errado sem deixar
    // rastro de "cancelamento" que não faz sentido pra esse tipo de registro.
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Remover(Guid id, CancellationToken ct)
    {
        var despesa = await _db.Despesas.FindAsync([id], ct);
        if (despesa is null) return NotFound();
        _db.Despesas.Remove(despesa);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}