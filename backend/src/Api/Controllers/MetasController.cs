using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdv.Domain.Entities;
using Pdv.Domain.Enums;
using Pdv.Infrastructure.Data;

namespace Pdv.Api.Controllers;

public record MetaRequest(string Tipo, DateTime PeriodoInicio, DateTime PeriodoFim, decimal ValorAlvo, string? Descricao);

[ApiController]
[Route("api/metas")]
[Authorize(Roles = "Administrador,Gerente")]
public class MetasController : ControllerBase
{
    private readonly PdvDbContext _db;
    public MetasController(PdvDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Listar(CancellationToken ct)
    {
        var metas = await _db.Metas.AsNoTracking()
            .OrderByDescending(m => m.PeriodoInicio)
            .ToListAsync(ct);

        // Para cada meta, soma o realizado (vendas não canceladas) no
        // período correspondente, para exibir o progresso visual.
        var resultado = new List<object>();
        foreach (var meta in metas)
        {
            var realizado = await _db.Vendas.AsNoTracking()
                .Where(v => !v.Cancelada && v.DataHora >= meta.PeriodoInicio && v.DataHora <= meta.PeriodoFim)
                .SumAsync(v => (decimal?)v.Total, ct) ?? 0m;

            var percentual = meta.ValorAlvo > 0 ? Math.Round(realizado / meta.ValorAlvo * 100, 1) : 0;

            resultado.Add(new
            {
                meta.Id,
                Tipo = meta.Tipo.ToString(),
                meta.PeriodoInicio,
                meta.PeriodoFim,
                meta.ValorAlvo,
                meta.Descricao,
                Realizado = realizado,
                Percentual = percentual
            });
        }

        return Ok(resultado);
    }

    [HttpPost]
    public async Task<IActionResult> Criar(MetaRequest request, CancellationToken ct)
    {
        var meta = new Meta
        {
            Tipo = Enum.Parse<TipoMeta>(request.Tipo, true),
            PeriodoInicio = request.PeriodoInicio,
            PeriodoFim = request.PeriodoFim,
            ValorAlvo = request.ValorAlvo,
            Descricao = request.Descricao
        };
        _db.Metas.Add(meta);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(Listar), new { }, new { meta.Id });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Editar(Guid id, MetaRequest request, CancellationToken ct)
    {
        var meta = await _db.Metas.FindAsync([id], ct);
        if (meta is null) return NotFound();

        meta.Tipo = Enum.Parse<TipoMeta>(request.Tipo, true);
        meta.PeriodoInicio = request.PeriodoInicio;
        meta.PeriodoFim = request.PeriodoFim;
        meta.ValorAlvo = request.ValorAlvo;
        meta.Descricao = request.Descricao;
        meta.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Remover(Guid id, CancellationToken ct)
    {
        var meta = await _db.Metas.FindAsync([id], ct);
        if (meta is null) return NotFound();
        _db.Metas.Remove(meta);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
