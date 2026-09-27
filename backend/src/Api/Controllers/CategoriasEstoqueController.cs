using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdv.Domain.Entities;
using Pdv.Domain.Enums;
using Pdv.Infrastructure.Data;
using Pdv.Infrastructure.Services;

namespace Pdv.Api.Controllers;

public record CategoriaRequest(string Nome);

[ApiController]
[Route("api/categorias")]
[Authorize]
public class CategoriasController : ControllerBase
{
    private readonly PdvDbContext _db;
    public CategoriasController(PdvDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Listar(CancellationToken ct) =>
        Ok(await _db.Categorias.AsNoTracking().Where(c => c.Ativo).OrderBy(c => c.Nome)
            .Select(c => new { c.Id, c.Nome }).ToListAsync(ct));

    [HttpPost]
    [Authorize(Roles = "Administrador,Gerente")]
    public async Task<IActionResult> Criar(CategoriaRequest request, CancellationToken ct)
    {
        var categoria = new Categoria { Nome = request.Nome };
        _db.Categorias.Add(categoria);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(Listar), new { categoria.Id });
    }
}

/// <summary>NovoPrecoCusto é opcional — quando informado, atualiza o
/// Produto.PrecoCusto e fica registrado no histórico de custo (ver
/// StockService.DevolverEstoqueAsync).</summary>
public record EntradaEstoqueRequest(Guid ProdutoId, int Quantidade, string? Observacao, decimal? NovoPrecoCusto);
public record AjusteEstoqueRequest(Guid ProdutoId, int NovaQuantidade, string Motivo);

[ApiController]
[Route("api/estoque")]
[Authorize(Roles = "Administrador,Gerente")]
public class EstoqueController : ControllerBase
{
    private readonly StockService _stock;
    private readonly PdvDbContext _db;

    public EstoqueController(StockService stock, PdvDbContext db)
    {
        _stock = stock;
        _db = db;
    }

    private Guid UsuarioId => Guid.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? User.FindFirst("sub")!.Value);

    [HttpGet("movimentos/{produtoId:guid}")]
    public async Task<IActionResult> Movimentos(Guid produtoId, CancellationToken ct)
    {
        var movimentos = await _db.MovimentosEstoque.AsNoTracking()
            .Where(m => m.ProdutoId == produtoId)
            .OrderByDescending(m => m.CreatedAt)
            .Take(200)
            .Select(m => new { m.Id, m.Tipo, m.Quantidade, m.EstoqueResultante, m.CreatedAt, m.Observacao, m.PrecoCustoRegistrado })
            .ToListAsync(ct);
        return Ok(movimentos);
    }

    /// <summary>
    /// TODAS as movimentações de estoque (entrada e saída), de todos os
    /// produtos, com filtro por tipo/produto/período — a tela de "controle
    /// de entrada e saída" geral usa esse endpoint, em vez de precisar abrir
    /// produto por produto.
    /// </summary>
    ///  [HttpGet("movimentos")]
    public async Task<IActionResult> TodosMovimentos(
        [FromQuery] TipoMovimentoEstoque? tipo, [FromQuery] Guid? produtoId,
        [FromQuery] DateTime? inicio, [FromQuery] DateTime? fim, CancellationToken ct)
    {
        var query = _db.MovimentosEstoque.AsNoTracking().AsQueryable();

        if (tipo.HasValue) query = query.Where(m => m.Tipo == tipo);
        if (produtoId.HasValue) query = query.Where(m => m.ProdutoId == produtoId);
        if (inicio.HasValue) query = query.Where(m => m.CreatedAt >= inicio.Value);
        if (fim.HasValue) query = query.Where(m => m.CreatedAt < fim.Value.Date.AddDays(1));

        var movimentos = await query
            .Include(m => m.Produto)
            .Include(m => m.Usuario)
            .OrderByDescending(m => m.CreatedAt)
            .Select(m => new
            {
                m.Id,
                Produto = m.Produto!.Nome,
                m.Tipo,
                m.Quantidade,
                m.EstoqueResultante,
                Usuario = m.Usuario!.Nome,
                m.CreatedAt,
                m.Observacao,
                m.PrecoCustoRegistrado
            })
            .Take(500)
            .ToListAsync(ct);

        return Ok(movimentos);
    }

    [HttpPost("entrada")]
    public async Task<IActionResult> Entrada(EntradaEstoqueRequest request, CancellationToken ct)
    {
        await _stock.DevolverEstoqueAsync(request.ProdutoId, request.Quantidade, UsuarioId,
            TipoMovimentoEstoque.Entrada, null, null, request.Observacao ?? "Entrada manual de estoque", ct, request.NovoPrecoCusto);
        return NoContent();
    }

    [HttpPost("ajuste")]
    public async Task<IActionResult> Ajuste(AjusteEstoqueRequest request, CancellationToken ct)
    {
        var produto = await _db.Produtos.FindAsync([request.ProdutoId], ct);
        if (produto is null) return NotFound();

        var diferenca = request.NovaQuantidade - produto.EstoqueAtual;
        if (diferenca == 0) return NoContent();

        if (diferenca > 0)
            await _stock.DevolverEstoqueAsync(request.ProdutoId, diferenca, UsuarioId,
                TipoMovimentoEstoque.Ajuste, null, null, $"Ajuste manual: {request.Motivo}", ct);
        else
            await _stock.BaixarEstoqueAsync(request.ProdutoId, -diferenca, UsuarioId,
                TipoMovimentoEstoque.Ajuste, null, null, $"Ajuste manual: {request.Motivo}", ct);

        return NoContent();
    }
}
