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

    /// <summary>
    /// Exporta o relatório financeiro do período em Excel: uma linha por
    /// dia, com total vendido, Pix, Cartão (crédito+débito somados) e
    /// Dinheiro — todos já em valor líquido (depois da taxa da maquininha),
    /// pra bater com o extrato dela.
    /// </summary>
    [HttpGet("exportar")]
    public async Task<IActionResult> Exportar([FromQuery] DateTime inicio, [FromQuery] DateTime fim, CancellationToken ct)
    {
        var fusoSaoPaulo = ObterFusoSaoPaulo();

        var inicioUtc = TimeZoneInfo.ConvertTimeToUtc(
            DateTime.SpecifyKind(inicio.Date, DateTimeKind.Unspecified), fusoSaoPaulo);
        var fimExclusivoUtc = TimeZoneInfo.ConvertTimeToUtc(
            DateTime.SpecifyKind(fim.Date.AddDays(1), DateTimeKind.Unspecified), fusoSaoPaulo);

        var pagamentos = await _db.Pagamentos.AsNoTracking()
            .Where(p => p.DataHora >= inicioUtc && p.DataHora < fimExclusivoUtc && p.VendaId != null && !p.Venda!.Cancelada)
            .Select(p => new { p.DataHora, p.Forma, p.Valor, p.ValorLiquido })
            .ToListAsync(ct);

        var porDia = pagamentos
            .GroupBy(p => TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(p.DataHora, DateTimeKind.Utc), fusoSaoPaulo).Date)
            .OrderBy(g => g.Key)
            .Select(g => new
            {
                Dia = g.Key,
                Pix = g.Where(p => p.Forma == FormaPagamento.Pix).Sum(p => p.ValorLiquido ?? p.Valor),
                Dinheiro = g.Where(p => p.Forma == FormaPagamento.Dinheiro).Sum(p => p.ValorLiquido ?? p.Valor),
                Cartao = g.Where(p => p.Forma == FormaPagamento.CartaoCredito || p.Forma == FormaPagamento.CartaoDebito || p.Forma == FormaPagamento.Cartao)
                          .Sum(p => p.ValorLiquido ?? p.Valor)
            })
            .ToList();

        using var workbook = new ClosedXML.Excel.XLWorkbook();
        var sheet = workbook.Worksheets.Add("Relatório financeiro");

        sheet.Cell(1, 1).Value = "Data";
        sheet.Cell(1, 2).Value = "Total vendido";
        sheet.Cell(1, 3).Value = "Pix";
        sheet.Cell(1, 4).Value = "Cartão (crédito + débito)";
        sheet.Cell(1, 5).Value = "Dinheiro";
        sheet.Row(1).Style.Font.Bold = true;

        var linha = 2;
        foreach (var dia in porDia)
        {
            var total = dia.Pix + dia.Dinheiro + dia.Cartao;
            sheet.Cell(linha, 1).Value = dia.Dia;
            sheet.Cell(linha, 1).Style.DateFormat.Format = "dd/MM/yyyy";
            sheet.Cell(linha, 2).Value = total;
            sheet.Cell(linha, 3).Value = dia.Pix;
            sheet.Cell(linha, 4).Value = dia.Cartao;
            sheet.Cell(linha, 5).Value = dia.Dinheiro;
            linha++;
        }

        sheet.Cell(linha, 1).Value = "TOTAL";
        sheet.Cell(linha, 2).FormulaA1 = linha > 2 ? $"=SUM(B2:B{linha - 1})" : "0";
        sheet.Cell(linha, 3).FormulaA1 = linha > 2 ? $"=SUM(C2:C{linha - 1})" : "0";
        sheet.Cell(linha, 4).FormulaA1 = linha > 2 ? $"=SUM(D2:D{linha - 1})" : "0";
        sheet.Cell(linha, 5).FormulaA1 = linha > 2 ? $"=SUM(E2:E{linha - 1})" : "0";
        sheet.Row(linha).Style.Font.Bold = true;

        for (var col = 2; col <= 5; col++)
            sheet.Column(col).Style.NumberFormat.Format = "#,##0.00";
        sheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);

        var nomeArquivo = $"relatorio-financeiro-{inicio:yyyy-MM-dd}-a-{fim:yyyy-MM-dd}.xlsx";
        return File(stream.ToArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", nomeArquivo);
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
                    Total = g.Sum(p => p.ValorLiquido ?? p.Valor)
                })
                .ToListAsync(ct);
        // Soma de tudo que realmente entra depois das taxas — é ESSE número
        // que deve ser mostrado como "quanto estou recebendo de verdade",
        // não o totalVendido (que é o valor bruto da venda).
        var valorLiquidoTotal = porFormaPagamento.Sum(f => f.Total);

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
            valorLiquidoTotal,
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