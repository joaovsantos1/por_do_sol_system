using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdv.Domain.Entities;
using Pdv.Infrastructure.Data;

namespace Pdv.Api.Controllers;

public record ComboItemRequest(Guid ProdutoId, int Quantidade);
public record ComboRequest(string Nome, string? Descricao, decimal PrecoVenda, List<ComboItemRequest> Itens);

[ApiController]
[Route("api/combos")]
[Authorize]
public class CombosController : ControllerBase
{
    private readonly PdvDbContext _db;
    public CombosController(PdvDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Listar([FromQuery] bool somenteAtivos = true, CancellationToken ct = default)
    {
        var query = _db.Combos.AsNoTracking().Include(c => c.Itens).ThenInclude(i => i.Produto).AsQueryable();
        if (somenteAtivos) query = query.Where(c => c.Ativo);

        var combos = await query.OrderBy(c => c.Nome).Select(c => new
        {
            c.Id,
            c.Nome,
            c.Descricao,
            c.PrecoVenda,
            c.Ativo,
            // Preço "avulso" de referência — soma do que custaria comprando
            // cada componente separado, pro frontend mostrar "de X por Y".
            PrecoAvulsoReferencia = c.Itens.Sum(i => i.Produto!.PrecoVenda * i.Quantidade),
            Itens = c.Itens.Select(i => new { i.ProdutoId, ProdutoNome = i.Produto!.Nome, i.Quantidade })
        }).ToListAsync(ct);

        return Ok(combos);
    }

    [HttpPost]
    [Authorize(Roles = "Administrador,Gerente")]
    public async Task<IActionResult> Criar(ComboRequest request, CancellationToken ct)
    {
        if (request.Itens is null || request.Itens.Count == 0)
            return BadRequest(new { erro = "Combo precisa de pelo menos um produto." });

        var combo = new Combo
        {
            Nome = request.Nome,
            Descricao = request.Descricao,
            PrecoVenda = request.PrecoVenda,
            Ativo = true
        };
        foreach (var item in request.Itens)
            combo.Itens.Add(new ComboItem { ProdutoId = item.ProdutoId, Quantidade = item.Quantidade });

        _db.Combos.Add(combo);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(Listar), new { }, new { combo.Id });
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Administrador,Gerente")]
    public async Task<IActionResult> Editar(Guid id, ComboRequest request, CancellationToken ct)
    {
        var combo = await _db.Combos.Include(c => c.Itens).SingleOrDefaultAsync(c => c.Id == id, ct);
        if (combo is null) return NotFound();

        combo.Nome = request.Nome;
        combo.Descricao = request.Descricao;
        combo.PrecoVenda = request.PrecoVenda;
        combo.UpdatedAt = DateTime.UtcNow;

        // Substitui os itens por completo — mais simples e seguro do que
        // tentar "casar" itens antigos com novos numa edição.
        _db.ComboItens.RemoveRange(combo.Itens);
        combo.Itens.Clear();
        foreach (var item in request.Itens)
            combo.Itens.Add(new ComboItem { ComboId = combo.Id, ProdutoId = item.ProdutoId, Quantidade = item.Quantidade });

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPatch("{id:guid}/inativar")]
    [Authorize(Roles = "Administrador,Gerente")]
    public async Task<IActionResult> Inativar(Guid id, CancellationToken ct)
    {
        var combo = await _db.Combos.FindAsync([id], ct);
        if (combo is null) return NotFound();
        combo.Ativo = false;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPatch("{id:guid}/ativar")]
    [Authorize(Roles = "Administrador,Gerente")]
    public async Task<IActionResult> Ativar(Guid id, CancellationToken ct)
    {
        var combo = await _db.Combos.FindAsync([id], ct);
        if (combo is null) return NotFound();
        combo.Ativo = true;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}