using System.Globalization;
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
    private readonly Pdv.Application.Vendas.VendaService _vendaService;
    private readonly PdvDbContext _db;
    private readonly IHubContext<ComandasHub> _hub;

    public ComandasController(ComandaService comandas, FechamentoService fechamento,
        Pdv.Application.Vendas.VendaService vendaService, PdvDbContext db, IHubContext<ComandasHub> hub)
    {
        _comandas = comandas;
        _fechamento = fechamento;
        _vendaService = vendaService;
        _db = db;
        _hub = hub;
    }

    private Guid UsuarioId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    /// <summary>
    /// Tenta interpretar uma data vinda da query string no formato yyyy-MM-dd
    /// (é o formato que o input type="date" do navegador sempre envia).
    /// Recebida como string (em vez de DateTime? direto no parâmetro da
    /// action) de propósito: o model binder automático do ASP.NET Core usa
    /// a cultura da thread, que pode variar entre ambientes (local vs.
    /// Render) e, se a conversão falhar, o [ApiController] devolve um 400
    /// automático em formato ProblemDetails — sem o corpo { erro: "..." }
    /// que o frontend espera — antes mesmo do código do controller rodar.
    /// Fazendo o parse manual aqui, garantimos uma mensagem de erro
    /// previsível independente do ambiente.
    /// </summary>
    private static bool TentarConverterData(string? valor, out DateTime data)
    {
        if (DateTime.TryParseExact(
            valor,
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var resultado))
        {
            var fusoSaoPaulo = TimeZoneInfo.FindSystemTimeZoneById(
                OperatingSystem.IsWindows()
                ? "E. South America Standard Time"
                : "America/Sao_Paulo"
            );
            data = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(resultado, DateTimeKind.Unspecified), fusoSaoPaulo);
            return true;
        }
        data = default;
        return false;

        // return DateTime.TryParseExact(valor, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out data);
    }

    /// <summary>
    /// Histórico de comandas com filtro por status (Aberta/Fechada/Cancelada)
    /// e período pela data de abertura, já incluindo os itens de cada
    /// comanda (para a tela de histórico mostrar o que foi vendido, não só
    /// o total). Usado pela tela de "Histórico de comandas" — a tela de
    /// "Comandas abertas" continua usando o endpoint /abertas, mais
    /// enxuto e mais rápido para o fluxo do caixa.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Listar(
        [FromQuery] string? status, [FromQuery] string? inicio, [FromQuery] string? fim, CancellationToken ct)
    {
        var query = _db.Comandas.AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<StatusComanda>(status, true, out var statusEnum))
                return BadRequest(new { erro = $"Status inválido: '{status}'." });
            query = query.Where(c => c.Status == statusEnum);
        }

        if (!string.IsNullOrWhiteSpace(inicio))
        {
            if (!TentarConverterData(inicio, out var dataInicio))
                return BadRequest(new { erro = $"Data de início inválida: '{inicio}'. Use o formato AAAA-MM-DD." });
            query = query.Where(c => c.AbertaEm >= dataInicio);
        }

        if (!string.IsNullOrWhiteSpace(fim))
        {
            if (!TentarConverterData(fim, out var dataFim))
                return BadRequest(new { erro = $"Data de fim inválida: '{fim}'. Use o formato AAAA-MM-DD." });
            query = query.Where(c => c.AbertaEm < dataFim.AddDays(1));
        }

        var comandas = await query
            .Include(c => c.AbertaPorUsuario)
            .Include(c => c.FechadaPorUsuario)
            .Include(c => c.Itens).ThenInclude(i => i.Produto)
            .OrderByDescending(c => c.AbertaEm)
            .Select(c => new
            {
                c.Id,
                c.Numero,
                c.CodigoIdentificador,
                c.NumeroMesa,
                c.NomeCliente,
                Status = c.Status.ToString(),
                c.AbertaEm,
                AbertaPor = c.AbertaPorUsuario!.Nome,
                c.FechadaEm,
                FechadaPor = c.FechadaPorUsuario != null ? c.FechadaPorUsuario.Nome : null,
                c.ValorTotal,
                Itens = c.Itens.Where(i => !i.Removido).Select(i => new
                {
                    i.Id,
                    ProdutoNome = i.Produto!.Nome,
                    i.Quantidade,
                    i.PrecoUnitario,
                    i.Subtotal
                })
            })
            .Take(300)
            .ToListAsync(ct);

        return Ok(comandas);
    }

    /// <summary>
    /// Estorna uma comanda já FECHADA: localiza a Venda gerada no fechamento
    /// e cancela por lá (VendaService.CancelarVendaAsync), que devolve os
    /// produtos ao estoque e registra o motivo — nunca apaga nada, só marca
    /// como cancelada/estornada (mesma regra de "nunca excluir venda" do
    /// restante do sistema).
    /// </summary>
    [HttpPost("{comandaId:guid}/estornar")]
    [Authorize(Roles = "Administrador,Gerente")]
    public async Task<IActionResult> Estornar(Guid comandaId, CancelarVendaRequest request, CancellationToken ct)
    {
        var venda = await _db.Vendas.SingleOrDefaultAsync(v => v.ComandaId == comandaId && !v.Cancelada, ct);
        if (venda is null)
            return NotFound(new { erro = "Nenhuma venda ativa encontrada para essa comanda (já pode estar estornada, ou a comanda nunca foi fechada)." });

        try
        {
            await _vendaService.CancelarVendaAsync(venda.Id, UsuarioId, request.Motivo, ct);
            await _hub.Clients.All.SendAsync("ComandaAtualizada", comandaId, ct);
            return NoContent();
        }
        catch (Pdv.Application.Vendas.VendaInvalidaException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

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
                c.NumeroMesa,
                c.NomeCliente,
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
                c.NumeroMesa,
                c.NomeCliente,
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
        var comanda = await _comandas.AbrirComandaAsync(UsuarioId, request.Observacoes, request.NumeroMesa, request.NomeCliente, ct);
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