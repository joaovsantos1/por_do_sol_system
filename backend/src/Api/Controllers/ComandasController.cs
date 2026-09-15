using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Pdv.Api.Hubs;
using Pdv.Application.Comandas;
using Pdv.Domain.Enums;
using Pdv.Infrastructure.Data;
using Pdv.Infrastructure.Services;

namespace Pdv.Api.Controllers;

[ApiController]
[Route("api/comandas")]
[Authorize(Roles = "Administrador,Gerente,Caixa,Operador")]
public class ComandasController : ControllerBase
{
    private readonly ComandaService _comandas;
    private readonly FechamentoService _fechamento;
    private readonly PdvDbContext _db;
    private readonly IHubContext<ComandasHub> _hub;

    public ComandasController(ComandaService comandas, FechamentoService fechamento, PdvDbContext db, IHubContext<ComandasHub> hub)
    {
        _comandas = comandas;
        _fechamento = fechamento;
        _db = db;
        _hub = hub;
    }

    private Guid UsuarioId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    [HttpGet("abertas")]
    public async Task<IActionResult> ListarAbertas(CancellationToken ct)
    {
        var comandas = await _db.Comandas
            .Where(c => c.Status == StatusComanda.Aberta)
            .Include(c => c.AbertaPorUsuario)
            .Include(c => c.Itens.Where(i => !i.Removido))
            .OrderByDescending(c => c.AbertaEm)
            .Select(c => new
            {
                c.Id,
                c.Numero,
                c.CodigoIdentificador,
                c.AbertaEm,
                AbertaPor = c.AbertaPorUsuario!.Nome,
                Itens = c.Itens.Count,
                c.ValorTotal
            })
            .ToListAsync(ct);

        return Ok(comandas);
    }

    /// <summary>Busca por número (digitado ou lido por scanner USB/código de barras) ou por Id.</summary>
    [HttpGet("{identificador}")]
    public async Task<IActionResult> Buscar(string identificador, CancellationToken ct)
    {
        var comanda = int.TryParse(identificador, out var numero)
            ? await CarregarComanda(c => c.Numero == numero, ct)
            : Guid.TryParse(identificador, out var id)
                ? await CarregarComanda(c => c.Id == id, ct)
                : await CarregarComanda(c => c.CodigoIdentificador == identificador, ct);

        if (comanda is null) return NotFound(new { erro = "Comanda não encontrada." });
        return Ok(comanda);
    }

    private async Task<object?> CarregarComanda(System.Linq.Expressions.Expression<Func<Domain.Entities.Comanda, bool>> predicate, CancellationToken ct)
    {
        return await _db.Comandas.Where(predicate)
            .Include(c => c.AbertaPorUsuario)
            .Include(c => c.Itens).ThenInclude(i => i.Produto)
            .Select(c => new
            {
                c.Id,
                c.Numero,
                c.CodigoIdentificador,
                Status = c.Status.ToString(),
                c.AbertaEm,
                AbertaPor = c.AbertaPorUsuario!.Nome,
                c.ValorTotal,
                c.Observacoes,
                Itens = c.Itens.Where(i => !i.Removido).Select(i => new
                {
                    i.Id,
                    i.ProdutoId,
                    ProdutoNome = i.Produto!.Nome,
                    i.Quantidade,
                    i.PrecoUnitario,
                    i.Subtotal
                })
            })
            .SingleOrDefaultAsync(ct);
    }

    /// <summary>
    /// QR Code (imagem PNG) representando apenas o identificador da comanda
    /// (ex.: "COMANDA-000152") — nunca os dados completos da venda. Ao
    /// escanear, o app aponta para GET /api/comandas/{identificador}, que
    /// retorna os dados atuais (sempre atualizados, nunca "congelados" no QR).
    /// Gerado com QRCoder (PngByteQRCode), sem dependência de System.Drawing,
    /// portanto funciona igual em Linux/containers.
    /// </summary>
    [HttpGet("{identificador}/qrcode")]
    [AllowAnonymous]
    public async Task<IActionResult> QrCode(string identificador, CancellationToken ct)
    {
        var comanda = await CarregarComandaMinima(identificador, ct);
        if (comanda is null) return NotFound();

        using var qrGenerator = new QRCoder.QRCodeGenerator();
        using var qrData = qrGenerator.CreateQrCode(comanda.CodigoIdentificador, QRCoder.QRCodeGenerator.ECCLevel.M);
        var pngQrCode = new QRCoder.PngByteQRCode(qrData);
        var bytes = pngQrCode.GetGraphic(10);

        return File(bytes, "image/png");
    }

    private async Task<Domain.Entities.Comanda?> CarregarComandaMinima(string identificador, CancellationToken ct)
    {
        if (int.TryParse(identificador, out var numero))
            return await _db.Comandas.AsNoTracking().SingleOrDefaultAsync(c => c.Numero == numero, ct);
        if (Guid.TryParse(identificador, out var id))
            return await _db.Comandas.AsNoTracking().SingleOrDefaultAsync(c => c.Id == id, ct);
        return await _db.Comandas.AsNoTracking().SingleOrDefaultAsync(c => c.CodigoIdentificador == identificador, ct);
    }

    [HttpPost("abrir")]
    public async Task<IActionResult> Abrir(AbrirComandaRequest request, CancellationToken ct)
    {
        var comanda = await _comandas.AbrirComandaAsync(UsuarioId, request.Observacoes, ct);
        await _hub.Clients.All.SendAsync("ComandaAberta", comanda.Id, ct);
        return CreatedAtAction(nameof(Buscar), new { identificador = comanda.Numero.ToString() },
            new { comanda.Id, comanda.Numero, comanda.CodigoIdentificador });
    }

    [HttpPost("{comandaId:guid}/itens")]
    public async Task<IActionResult> AdicionarItem(Guid comandaId, AdicionarItemRequest request, CancellationToken ct)
    {
        try
        {
            var item = await _comandas.AdicionarItemAsync(comandaId, request.ProdutoId, request.Quantidade, UsuarioId, ct);
            await _hub.Clients.All.SendAsync("ComandaAtualizada", comandaId, ct);
            return Ok(new { item.Id, item.ProdutoId, item.Quantidade, item.Subtotal });
        }
        catch (EstoqueInsuficienteException ex)
        {
            return Conflict(new { erro = ex.Message });
        }
        catch (ComandaInvalidaException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpPut("{comandaId:guid}/itens/{itemId:guid}")]
    public async Task<IActionResult> AlterarQuantidade(Guid comandaId, Guid itemId, AlterarQuantidadeRequest request, CancellationToken ct)
    {
        try
        {
            await _comandas.AlterarQuantidadeAsync(comandaId, itemId, request.NovaQuantidade, UsuarioId, ct);
            await _hub.Clients.All.SendAsync("ComandaAtualizada", comandaId, ct);
            return NoContent();
        }
        catch (EstoqueInsuficienteException ex)
        {
            return Conflict(new { erro = ex.Message });
        }
        catch (ComandaInvalidaException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpDelete("{comandaId:guid}/itens/{itemId:guid}")]
    public async Task<IActionResult> RemoverItem(Guid comandaId, Guid itemId, CancellationToken ct)
    {
        try
        {
            await _comandas.RemoverItemAsync(comandaId, itemId, UsuarioId, ct);
            await _hub.Clients.All.SendAsync("ComandaAtualizada", comandaId, ct);
            return NoContent();
        }
        catch (ComandaInvalidaException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpPost("{comandaId:guid}/cancelar")]
    [Authorize(Roles = "Administrador,Gerente,Caixa")]
    public async Task<IActionResult> Cancelar(Guid comandaId, CancellationToken ct)
    {
        try
        {
            await _comandas.CancelarComandaAsync(comandaId, UsuarioId, ct);
            await _hub.Clients.All.SendAsync("ComandaAtualizada", comandaId, ct);
            return NoContent();
        }
        catch (ComandaInvalidaException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpPost("{comandaId:guid}/fechar")]
    [Authorize(Roles = "Administrador,Gerente,Caixa")]
    public async Task<IActionResult> Fechar(Guid comandaId, FecharComandaRequest request, CancellationToken ct)
    {
        try
        {
            var pagamentos = request.Pagamentos
                .Select(p => (Enum.Parse<FormaPagamento>(p.Forma, true), p.Valor))
                .ToList();

            var venda = await _fechamento.FecharComandaAsync(comandaId, pagamentos, UsuarioId, ct);
            await _hub.Clients.All.SendAsync("ComandaAtualizada", comandaId, ct);
            return Ok(new { venda.Id, venda.Total, venda.DataHora });
        }
        catch (PagamentoInsuficienteException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (ComandaInvalidaException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }
}
