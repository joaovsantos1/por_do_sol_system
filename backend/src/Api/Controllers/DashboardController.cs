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

    private static TimeZoneInfo ObterFusoSaoPaulo()
    {
        try
        {
            // Windows
            return TimeZoneInfo.FindSystemTimeZoneById(
                "E. South America Standard Time");
        }
        catch (TimeZoneNotFoundException)
        {
            // Linux / Render
            return TimeZoneInfo.FindSystemTimeZoneById(
                "America/Sao_Paulo");
        }
    }

    /// <summary>
    /// Resumo do dia atual no fuso de São Paulo.
    /// Os limites do dia são convertidos para UTC antes da consulta ao banco.
    /// </summary>
    [HttpGet("hoje")]
    public async Task<IActionResult> Hoje(CancellationToken ct)
    {
        var fusoSaoPaulo = ObterFusoSaoPaulo();

        var agoraSaoPaulo = TimeZoneInfo.ConvertTimeFromUtc(
            DateTime.UtcNow,
            fusoSaoPaulo
        );

        var inicioLocal = agoraSaoPaulo.Date;
        var fimLocal = inicioLocal.AddDays(1);

        var inicioUtc = TimeZoneInfo.ConvertTimeToUtc(
            DateTime.SpecifyKind(
                inicioLocal,
                DateTimeKind.Unspecified
            ),
            fusoSaoPaulo
        );

        var fimUtc = TimeZoneInfo.ConvertTimeToUtc(
            DateTime.SpecifyKind(
                fimLocal,
                DateTimeKind.Unspecified
            ),
            fusoSaoPaulo
        );

        return Ok(await ResumoPeriodoAsync(
            inicioUtc,
            fimUtc,
            ct
        ));
    }

    [HttpGet("periodo")]
    public async Task<IActionResult> Periodo(
        [FromQuery] DateTime inicio,
        [FromQuery] DateTime fim,
        CancellationToken ct)
    {
        var fusoSaoPaulo = ObterFusoSaoPaulo();

        var inicioUtc = TimeZoneInfo.ConvertTimeToUtc(
            DateTime.SpecifyKind(
                inicio.Date,
                DateTimeKind.Unspecified
            ),
            fusoSaoPaulo
        );

        var fimExclusivoUtc = TimeZoneInfo.ConvertTimeToUtc(
            DateTime.SpecifyKind(
                fim.Date.AddDays(1),
                DateTimeKind.Unspecified
            ),
            fusoSaoPaulo
        );

        return Ok(await ResumoPeriodoAsync(
            inicioUtc,
            fimExclusivoUtc,
            ct
        ));
    }

    private async Task<object> ResumoPeriodoAsync(
        DateTime inicio,
        DateTime fimExclusivo,
        CancellationToken ct)
    {
        var fusoSaoPaulo = ObterFusoSaoPaulo();

        var vendas = _db.Vendas
            .AsNoTracking()
            .Where(v =>
                !v.Cancelada &&
                v.DataHora >= inicio &&
                v.DataHora < fimExclusivo);

        var totalVendido =
            await vendas.SumAsync(
                v => (decimal?)v.Total,
                ct
            ) ?? 0m;

        var numeroVendas =
            await vendas.CountAsync(ct);

        var ticketMedio =
            numeroVendas > 0
                ? totalVendido / numeroVendas
                : 0m;

        var comandasAbertas =
            await _db.Comandas.CountAsync(
                c => c.Status == StatusComanda.Aberta,
                ct
            );

        var comandasFechadas =
            await _db.Comandas.CountAsync(
                c =>
                    c.Status == StatusComanda.Fechada &&
                    c.FechadaEm >= inicio &&
                    c.FechadaEm < fimExclusivo,
                ct
            );

        var porFormaPagamento =
            await _db.Pagamentos
                .AsNoTracking()
                .Where(p =>
                    p.DataHora >= inicio &&
                    p.DataHora < fimExclusivo &&
                    p.VendaId != null &&
                    !p.Venda!.Cancelada)
                .GroupBy(p => p.Forma)
                .Select(g => new
                {
                    Forma = g.Key.ToString(),
                    Total = g.Sum(p => p.Valor)
                })
                .ToListAsync(ct);

        // Busca somente os dados necessários para o gráfico.
        // A conversão para São Paulo é feita antes do agrupamento,
        // pois DataHora está armazenado em UTC.
        var vendasParaGrafico =
            await vendas
                .Select(v => new
                {
                    v.DataHora,
                    v.Total
                })
                .ToListAsync(ct);

        var vendasPorDia =
            vendasParaGrafico
                .GroupBy(v =>
                    TimeZoneInfo.ConvertTimeFromUtc(
                        DateTime.SpecifyKind(
                            v.DataHora,
                            DateTimeKind.Utc
                        ),
                        fusoSaoPaulo
                    ).Date
                )
                .Select(g => new
                {
                    Dia = g.Key,
                    Total = g.Sum(v => v.Total)
                })
                .OrderBy(g => g.Dia)
                .Select(g => new
                {
                    Dia = g.Dia.ToString("dd/MM"),
                    g.Total
                })
                .ToList();

        var produtosMaisVendidos =
            await _db.VendaItens
                .AsNoTracking()
                .Where(i =>
                    i.Venda!.DataHora >= inicio &&
                    i.Venda!.DataHora < fimExclusivo &&
                    !i.Venda!.Cancelada)
                .GroupBy(i => i.ProdutoNomeSnapshot)
                .Select(g => new
                {
                    Produto = g.Key,
                    Quantidade = g.Sum(i => i.Quantidade)
                })
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