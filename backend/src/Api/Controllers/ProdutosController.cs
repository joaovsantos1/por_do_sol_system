using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdv.Domain.Entities;
using Pdv.Domain.Enums;
using Pdv.Infrastructure.Data;
using Pdv.Infrastructure.Services;

namespace Pdv.Api.Controllers;

public record ProdutoRequest(
    string Codigo, string? CodigoBarras, string Nome, string? Descricao,
    Guid CategoriaId, decimal PrecoVenda, decimal PrecoCusto,
    int EstoqueMinimo, string Unidade, string? ImagemUrl);

/// <summary>Usado somente na criação — inclui o estoque inicial (item 23/9 do
/// documento: todo produto novo pode já entrar com uma quantidade em estoque).
/// A edição de um produto existente NUNCA altera estoque diretamente; isso
/// deve passar pelos endpoints de /api/estoque (entrada/ajuste), que geram
/// movimentação — ver StockService.</summary>
public record CriarProdutoRequest(
    string Codigo, string? CodigoBarras, string Nome, string? Descricao,
    Guid CategoriaId, decimal PrecoVenda, decimal PrecoCusto,
    int EstoqueInicial, int EstoqueMinimo, string Unidade, string? ImagemUrl);

[ApiController]
[Route("api/produtos")]
[Authorize]
public class ProdutosController : ControllerBase
{
    private readonly PdvDbContext _db;
    private readonly IStockService _stock;
    public ProdutosController(PdvDbContext db, IStockService stock)
    {
        _db = db;
        _stock = stock;
    }

    private Guid UsuarioId => Guid.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? User.FindFirst("sub")!.Value);

    [HttpGet]
    public async Task<IActionResult> Listar([FromQuery] string? busca, [FromQuery] Guid? categoriaId, [FromQuery] bool somenteAtivos = true, CancellationToken ct = default)
    {
        var query = _db.Produtos.AsNoTracking().Include(p => p.Categoria).AsQueryable();
        if (somenteAtivos) query = query.Where(p => p.Ativo);
        if (categoriaId.HasValue) query = query.Where(p => p.CategoriaId == categoriaId);
        if (!string.IsNullOrWhiteSpace(busca))
            query = query.Where(p => p.Nome.Contains(busca) || p.Codigo.Contains(busca) || (p.CodigoBarras != null && p.CodigoBarras.Contains(busca)));

        var produtos = await query.OrderBy(p => p.Nome).Select(p => new
        {
            p.Id, p.Codigo, p.CodigoBarras, p.Nome, p.PrecoVenda, p.PrecoCusto, p.EstoqueAtual,
            p.EstoqueMinimo, EstoqueBaixo = p.EstoqueAtual <= p.EstoqueMinimo,
            p.CategoriaId, Categoria = p.Categoria!.Nome, p.Ativo, p.ImagemUrl, p.Unidade, p.Descricao
        }).ToListAsync(ct);

        return Ok(produtos);
    }

    [HttpGet("estoque-baixo")]
    public async Task<IActionResult> EstoqueBaixo(CancellationToken ct)
    {
        var produtos = await _db.Produtos.AsNoTracking()
            .Where(p => p.Ativo && p.EstoqueAtual <= p.EstoqueMinimo)
            .OrderBy(p => p.EstoqueAtual)
            .Select(p => new { p.Id, p.Nome, p.EstoqueAtual, p.EstoqueMinimo })
            .ToListAsync(ct);
        return Ok(produtos);
    }

    [HttpPost]
    [Authorize(Roles = "Administrador,Gerente")]
    public async Task<IActionResult> Criar(CriarProdutoRequest request, CancellationToken ct)
    {
        var produto = new Produto
        {
            Codigo = request.Codigo,
            CodigoBarras = request.CodigoBarras,
            Nome = request.Nome,
            Descricao = request.Descricao,
            CategoriaId = request.CategoriaId,
            PrecoVenda = request.PrecoVenda,
            PrecoCusto = request.PrecoCusto,
            EstoqueMinimo = request.EstoqueMinimo,
            Unidade = request.Unidade,
            ImagemUrl = request.ImagemUrl,
            EstoqueAtual = 0
        };
        _db.Produtos.Add(produto);
        await _db.SaveChangesAsync(ct);

        // Estoque inicial entra como uma movimentação de ENTRADA de verdade
        // (não um valor solto), preservando a regra de nunca alterar estoque
        // sem gerar histórico.
        if (request.EstoqueInicial > 0)
        {
            await _stock.DevolverEstoqueAsync(produto.Id, request.EstoqueInicial, UsuarioId,
                TipoMovimentoEstoque.Entrada, null, null, "Estoque inicial no cadastro do produto", ct);
        }

        return CreatedAtAction(nameof(Listar), new { }, new { produto.Id });
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Administrador,Gerente")]
    public async Task<IActionResult> Editar(Guid id, ProdutoRequest request, CancellationToken ct)
    {
        var produto = await _db.Produtos.FindAsync([id], ct);
        if (produto is null) return NotFound();

        produto.Codigo = request.Codigo;
        produto.CodigoBarras = request.CodigoBarras;
        produto.Nome = request.Nome;
        produto.Descricao = request.Descricao;
        produto.CategoriaId = request.CategoriaId;
        produto.PrecoVenda = request.PrecoVenda;
        produto.PrecoCusto = request.PrecoCusto;
        produto.EstoqueMinimo = request.EstoqueMinimo;
        produto.Unidade = request.Unidade;
        produto.ImagemUrl = request.ImagemUrl;
        produto.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // Nunca exclusão física — produtos com histórico de vendas não podem ser apagados.
    [HttpPatch("{id:guid}/inativar")]
    [Authorize(Roles = "Administrador,Gerente")]
    public async Task<IActionResult> Inativar(Guid id, CancellationToken ct)
    {
        var produto = await _db.Produtos.FindAsync([id], ct);
        if (produto is null) return NotFound();
        produto.Ativo = false;
        produto.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPatch("{id:guid}/ativar")]
    [Authorize(Roles = "Administrador,Gerente")]
    public async Task<IActionResult> Ativar(Guid id, CancellationToken ct)
    {
        var produto = await _db.Produtos.FindAsync([id], ct);
        if (produto is null) return NotFound();
        produto.Ativo = true;
        produto.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
