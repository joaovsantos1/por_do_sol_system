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
                v.Id, v.DataHora, Usuario = v.Usuario!.Nome, v.Total, v.Cancelada
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
                v.Id, v.DataHora, Usuario = v.Usuario!.Nome, v.Total, v.Desconto, v.Cancelada,
                v.MotivoCancelamento,
                Itens = v.Itens.Select(i => new { i.ProdutoNomeSnapshot, i.Quantidade, i.PrecoUnitario, i.Subtotal }),
                Pagamentos = v.Pagamentos.Select(p => new { p.Forma, p.Valor })
            })
            .SingleOrDefaultAsync(ct);

        return venda is null ? NotFound() : Ok(venda);
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
