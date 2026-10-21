using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdv.Application.Vendas;
using Pdv.Infrastructure.Data;

namespace Pdv.Api.Controllers;

public record CancelarVendaRequest(string Motivo);

[ApiController]
[Route("api/sales")]
[Authorize]
public class VendasController : ControllerBase
{
    private readonly PdvDbContext _db;
    private readonly VendaService _vendaService;

    public VendasController(PdvDbContext db, VendaService vendaService)
    {
        _db = db;
        _vendaService = vendaService;
    }

    private Guid UsuarioId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> Listar([FromQuery] DateTime? inicio, [FromQuery] DateTime? fim, CancellationToken ct)
    {
        var dataInicio = inicio ?? DateTime.UtcNow.Date;
        var dataFim = (fim ?? DateTime.UtcNow.Date).Date.AddDays(1);

        var vendas = await _db.Vendas.AsNoTracking()
            .Include(v => v.Usuario)
            .Where(v => v.DataHora >= dataInicio && v.DataHora < dataFim)
            .OrderByDescending(v => v.DataHora)
            .Select(v => new
            {
                v.Id,
                v.DataHora,
                Usuario = v.Usuario!.Nome,
                v.Total,
                v.Cancelada
            })
            .ToListAsync(ct);

        return Ok(vendas);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Detalhe(Guid id, CancellationToken ct)
    {
        var venda = await _db.Vendas.AsNoTracking()
            .Include(v => v.Usuario)
            .Include(v => v.Itens)
            .Include(v => v.Pagamentos)
            .Where(v => v.Id == id)
            .Select(v => new
            {
                v.Id,
                v.DataHora,
                Usuario = v.Usuario!.Nome,
                v.Total,
                v.Desconto,
                v.Cancelada,
                v.MotivoCancelamento,
                Itens = v.Itens.Select(i => new { i.ProdutoNomeSnapshot, i.Quantidade, i.PrecoUnitario, i.Subtotal }),
                Pagamentos = v.Pagamentos.Select(p => new { p.Forma, p.Valor, p.ValorLiquido })
            })
            .SingleOrDefaultAsync(ct);

        return venda is null ? NotFound() : Ok(venda);
    }

    [HttpGet("por-comanda/{comandaId:guid}")]
    public async Task<IActionResult> PorComanda(Guid comandaId, CancellationToken ct)
    {
        var venda = await _db.Vendas.AsNoTracking()
            .Include(v => v.Comanda)
            .Include(v => v.Itens)
            .Include(v => v.Pagamentos)
            .Where(v => v.ComandaId == comandaId && !v.Cancelada)
            .OrderByDescending(v => v.DataHora)
            .FirstOrDefaultAsync(ct);

        if (venda is null)
            return NotFound(new { erro = "Nenhuma venda ativa encontrada para essa comanda (pode ter sido estornada)." });

        return Ok(new
        {
            numeroComanda = venda.Comanda!.Numero,
            numeroMesa = venda.Comanda.NumeroMesa,
            nomeCliente = venda.Comanda.NomeCliente,
            itens = venda.Itens.Select(i => new { nome = i.ProdutoNomeSnapshot, i.Quantidade, i.PrecoUnitario, i.Subtotal }),
            subtotal = venda.Itens.Sum(i => i.Subtotal),
            desconto = venda.Desconto,
            taxaServico = venda.TaxaServico,
            total = venda.Total,
            pagamentos = venda.Pagamentos.Select(p => new { forma = p.Forma.ToString(), valor = p.Valor }),
            dataHora = venda.DataHora
        });
    }

    [HttpPost("{id:guid}/cancelar")]
    [Authorize(Roles = "Administrador,Gerente")]
    public async Task<IActionResult> Cancelar(Guid id, CancelarVendaRequest request, CancellationToken ct)
    {
        try
        {
            await _vendaService.CancelarVendaAsync(id, UsuarioId, request.Motivo, ct);
            return NoContent();
        }
        catch (VendaInvalidaException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }
}
