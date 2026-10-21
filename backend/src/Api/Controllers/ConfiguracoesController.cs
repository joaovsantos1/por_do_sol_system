using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdv.Domain.Entities;
using Pdv.Infrastructure.Data;

namespace Pdv.Api.Controllers;

public record TaxasRequest(decimal TaxaCartaoCreditoPercentual, decimal TaxaCartaoDebitoPercentual, bool TaxaServicoAtiva, decimal TaxaServicoPercentual);

/// <summary>
/// Configurações gerais do sistema. Por ora só as taxas da maquininha de
/// cartão, mas o controller já fica pronto pra crescer com outras
/// configurações no futuro.
/// </summary>
[ApiController]
[Route("api/configuracoes")]
[Authorize]
public class ConfiguracoesController : ControllerBase
{
    private readonly PdvDbContext _db;
    public ConfiguracoesController(PdvDbContext db) => _db = db;

    // GET liberado pra qualquer perfil logado (Caixa/Operador também
    // precisam consultar a taxa vigente pra calcular o valor líquido na
    // hora de fechar uma comanda).
    [HttpGet("taxas")]
    public async Task<IActionResult> ObterTaxas(CancellationToken ct)
    {
        var config = await _db.ConfiguracoesTaxas.AsNoTracking().FirstOrDefaultAsync(ct);
        return Ok(new
        {
            taxaCartaoCreditoPercentual = config?.TaxaCartaoCreditoPercentual ?? 0m,
            taxaCartaoDebitoPercentual = config?.TaxaCartaoDebitoPercentual ?? 0m,
            taxaServicoAtiva = config?.TaxaServicoAtiva ?? false,
            taxaServicoPercentual = config?.TaxaServicoPercentual ?? 10m
        });
    }

    [HttpPut("taxas")]
    [Authorize(Roles = "Administrador")]
    public async Task<IActionResult> AtualizarTaxas(TaxasRequest request, CancellationToken ct)
    {
        if (request.TaxaCartaoCreditoPercentual < 0 || request.TaxaCartaoCreditoPercentual > 100 ||
            request.TaxaCartaoDebitoPercentual < 0 || request.TaxaCartaoDebitoPercentual > 100 ||
            request.TaxaServicoPercentual < 0 || request.TaxaServicoPercentual > 100)
            return BadRequest(new { erro = "A taxa deve estar entre 0 e 100%." });

        var config = await _db.ConfiguracoesTaxas.FirstOrDefaultAsync(ct);
        if (config is null)
        {
            config = new ConfiguracaoTaxas();
            _db.ConfiguracoesTaxas.Add(config);
        }

        config.TaxaCartaoCreditoPercentual = request.TaxaCartaoCreditoPercentual;
        config.TaxaCartaoDebitoPercentual = request.TaxaCartaoDebitoPercentual;
        config.TaxaServicoAtiva = request.TaxaServicoAtiva;
        config.TaxaServicoPercentual = request.TaxaServicoPercentual;
        config.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}