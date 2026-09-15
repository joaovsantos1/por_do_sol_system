using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdv.Domain.Enums;
using Pdv.Infrastructure.Data;

namespace Pdv.Api.Controllers;

public record PeriodoQuery(DateTime? Inicio, DateTime? Fim);

[ApiController]
[Route("api/dashboard")]
[Authorize(Roles = "Administrador,Gerente")]
public class DashboardController : ControllerBase
{
    private readonly PdvDbContext _db;
    public DashboardController(PdvDbContext db) => _db = db;

    /// <summary>
    /// Resumo do dia atual (fuso UTC): total vendido, número de vendas,
    /// ticket médio, comandas abertas/fechadas e vendas por forma de pagamento.
    /// </summary>
    [HttpGet("hoje")]
    public async Task<IActionResult> Hoje(CancellationToken ct)
    {
        var inicio = DateTime.UtcNow.Date;
        var fim = inicio.AddDays(1);
        return Ok(await ResumoPeriodoAsync(inicio, fim, ct));
    }

    [HttpGet("periodo")]
    public async Task<IActionResult> Periodo(
    [FromQuery] DateTime inicio,
    [FromQuery] DateTime fim,
    CancellationToken ct)
    {
        var inicioUtc = DateTime.SpecifyKind(
            inicio.Date,
            DateTimeKind.Utc
        );

        var fimExclusivoUtc = DateTime.SpecifyKind(
            fim.Date.AddDays(1),
            DateTimeKind.Utc
        );

        return Ok(await ResumoPeriodoAsync(
            inicioUtc,
            fimExclusivoUtc,
            ct
        ));
    }

    private async Task<object> ResumoPeriodoAsync(DateTime inicio, DateTime fimExclusivo, CancellationToken ct)
    {
        var vendas = _db.Vendas.AsNoTracking()
            .Where(v => !v.Cancelada && v.DataHora >= inicio && v.DataHora < fimExclusivo);

        var totalVendido = await vendas.SumAsync(v => (decimal?)v.Total, ct) ?? 0m;
        var numeroVendas = await vendas.CountAsync(ct);
        var ticketMedio = numeroVendas > 0 ? totalVendido / numeroVendas : 0m;

        var comandasAbertas = await _db.Comandas.CountAsync(c => c.Status == StatusComanda.Aberta, ct);
        var comandasFechadas = await _db.Comandas.CountAsync(
            c => c.Status == StatusComanda.Fechada && c.FechadaEm >= inicio && c.FechadaEm < fimExclusivo, ct);

        var porFormaPagamento = await _db.Pagamentos.AsNoTracking()
            .Where(p => p.DataHora >= inicio && p.DataHora < fimExclusivo)
            .GroupBy(p => p.Forma)
            .Select(g => new { Forma = g.Key.ToString(), Total = g.Sum(p => p.Valor) })
            .ToListAsync(ct);

        var vendasPorDia = await vendas
            .GroupBy(v => v.DataHora.Date)
            .Select(g => new { Dia = g.Key, Total = g.Sum(v => v.Total) })
            .OrderBy(g => g.Dia)
            .ToListAsync(ct);

        var produtosMaisVendidos = await _db.VendaItens.AsNoTracking()
            .Where(i => i.Venda!.DataHora >= inicio && i.Venda!.DataHora < fimExclusivo && !i.Venda!.Cancelada)
            .GroupBy(i => i.ProdutoNomeSnapshot)
            .Select(g => new { Produto = g.Key, Quantidade = g.Sum(i => i.Quantidade) })
            .OrderByDescending(g => g.Quantidade)
            .Take(10)
            .ToListAsync(ct);

        return new
        {
            totalVendido,
            numeroVendas,
            ticketMedio,
            comandasAbertas,
            comandasFechadas,
            porFormaPagamento,
            vendasPorDia,
            produtosMaisVendidos
        };
    }
}
