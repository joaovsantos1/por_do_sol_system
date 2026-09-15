using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdv.Domain.Enums;
using Pdv.Infrastructure.Data;

namespace Pdv.Api.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize(Roles = "Administrador,Gerente")]
public class RelatoriosController : ControllerBase
{
    private readonly PdvDbContext _db;
    public RelatoriosController(PdvDbContext db) => _db = db;

    [HttpGet("vendas")]
    public async Task<IActionResult> Vendas(
        [FromQuery] DateTime inicio, [FromQuery] DateTime fim,
        [FromQuery] Guid? usuarioId, [FromQuery] Guid? produtoId, CancellationToken ct)
    {
        var fimExclusivo = fim.Date.AddDays(1);

        var query = _db.Vendas.AsNoTracking()
            .Where(v => !v.Cancelada && v.DataHora >= inicio && v.DataHora < fimExclusivo);

        if (usuarioId.HasValue) query = query.Where(v => v.UsuarioId == usuarioId);
        if (produtoId.HasValue) query = query.Where(v => v.Itens.Any(i => i.ProdutoId == produtoId));

        var vendas = await query
            .Include(v => v.Usuario)
            .Include(v => v.Itens)
            .OrderByDescending(v => v.DataHora)
            .Select(v => new
            {
                v.Id,
                v.DataHora,
                Usuario = v.Usuario!.Nome,
                v.Total,
                v.Desconto,
                QuantidadeItens = v.Itens.Sum(i => i.Quantidade)
            })
            .ToListAsync(ct);

        var porUsuario = await query.Include(v => v.Usuario)
            .GroupBy(v => v.Usuario!.Nome)
            .Select(g => new { Usuario = g.Key, Total = g.Sum(v => v.Total), Quantidade = g.Count() })
            .ToListAsync(ct);

        var porFormaPagamento = await _db.Pagamentos.AsNoTracking()
            .Where(p => p.DataHora >= inicio && p.DataHora < fimExclusivo)
            .GroupBy(p => p.Forma)
            .Select(g => new { Forma = g.Key.ToString(), Total = g.Sum(p => p.Valor) })
            .ToListAsync(ct);

        var porCategoria = await _db.VendaItens.AsNoTracking()
            .Where(i => i.Venda!.DataHora >= inicio && i.Venda!.DataHora < fimExclusivo && !i.Venda!.Cancelada)
            .Include(i => i.Produto).ThenInclude(p => p!.Categoria)
            .GroupBy(i => i.Produto!.Categoria!.Nome)
            .Select(g => new { Categoria = g.Key, Total = g.Sum(i => i.Subtotal) })
            .ToListAsync(ct);

        return Ok(new { vendas, porUsuario, porFormaPagamento, porCategoria });
    }

    [HttpGet("estoque")]
    public async Task<IActionResult> Estoque(CancellationToken ct)
    {
        var atual = await _db.Produtos.AsNoTracking().Where(p => p.Ativo)
            .Select(p => new { p.Id, p.Nome, p.EstoqueAtual, p.EstoqueMinimo })
            .ToListAsync(ct);

        var baixo = atual.Where(p => p.EstoqueAtual <= p.EstoqueMinimo).ToList();

        return Ok(new { atual, baixo });
    }

    [HttpGet("estoque/movimentacoes")]
    public async Task<IActionResult> Movimentacoes(
        [FromQuery] DateTime inicio, [FromQuery] DateTime fim,
        [FromQuery] TipoMovimentoEstoque? tipo, CancellationToken ct)
    {
        var fimExclusivo = fim.Date.AddDays(1);
        var query = _db.MovimentosEstoque.AsNoTracking()
            .Where(m => m.CreatedAt >= inicio && m.CreatedAt < fimExclusivo);
        if (tipo.HasValue) query = query.Where(m => m.Tipo == tipo);

        var movimentos = await query.Include(m => m.Produto).Include(m => m.Usuario)
            .OrderByDescending(m => m.CreatedAt)
            .Select(m => new
            {
                m.Id, Produto = m.Produto!.Nome, m.Tipo, m.Quantidade,
                m.EstoqueResultante, Usuario = m.Usuario!.Nome, m.CreatedAt, m.Observacao
            })
            .Take(500)
            .ToListAsync(ct);

        return Ok(movimentos);
    }

    [HttpGet("comandas")]
    public async Task<IActionResult> Comandas([FromQuery] DateTime inicio, [FromQuery] DateTime fim, CancellationToken ct)
    {
        var fimExclusivo = fim.Date.AddDays(1);
        var comandas = await _db.Comandas.AsNoTracking()
            .Where(c => c.AbertaEm >= inicio && c.AbertaEm < fimExclusivo)
            .ToListAsync(ct);

        var abertas = comandas.Count(c => c.Status == StatusComanda.Aberta);
        var fechadas = comandas.Count(c => c.Status == StatusComanda.Fechada);
        var canceladas = comandas.Count(c => c.Status == StatusComanda.Cancelada);

        var tempoMedioMinutos = comandas
            .Where(c => c.Status == StatusComanda.Fechada && c.FechadaEm.HasValue)
            .Select(c => (c.FechadaEm!.Value - c.AbertaEm).TotalMinutes)
            .DefaultIfEmpty(0)
            .Average();

        return Ok(new { abertas, fechadas, canceladas, tempoMedioMinutos = Math.Round(tempoMedioMinutos, 1) });
    }

    [HttpGet("financeiro")]
    public async Task<IActionResult> Financeiro([FromQuery] DateTime inicio, [FromQuery] DateTime fim, CancellationToken ct)
    {
        var fimExclusivo = fim.Date.AddDays(1);
        var vendas = _db.Vendas.AsNoTracking().Where(v => !v.Cancelada && v.DataHora >= inicio && v.DataHora < fimExclusivo);

        var faturamento = await vendas.SumAsync(v => (decimal?)v.Total, ct) ?? 0m;
        var quantidade = await vendas.CountAsync(ct);
        var ticketMedio = quantidade > 0 ? faturamento / quantidade : 0m;

        var porFormaPagamento = await _db.Pagamentos.AsNoTracking()
            .Where(p => p.DataHora >= inicio && p.DataHora < fimExclusivo)
            .GroupBy(p => p.Forma)
            .Select(g => new { Forma = g.Key.ToString(), Total = g.Sum(p => p.Valor) })
            .ToListAsync(ct);

        return Ok(new { faturamento, ticketMedio, porFormaPagamento });
    }
}
