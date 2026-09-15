using Microsoft.EntityFrameworkCore;
using Pdv.Domain.Entities;
using Pdv.Domain.Enums;
using Pdv.Infrastructure.Data;
using Pdv.Infrastructure.Services;

namespace Pdv.Application.Vendas;

public class VendaInvalidaException : Exception
{
    public VendaInvalidaException(string mensagem) : base(mensagem) { }
}

/// <summary>
/// Cancelamento/estorno de uma venda já fechada. Nunca apaga a venda —
/// apenas marca como cancelada, devolve os produtos ao estoque (gerando
/// movimentação) e registra quem cancelou, quando e por quê. Relatórios
/// filtram vendas canceladas automaticamente (Cancelada == false).
/// </summary>
public class VendaService
{
    private readonly PdvDbContext _db;
    private readonly StockService _stock;

    public VendaService(PdvDbContext db, StockService stock)
    {
        _db = db;
        _stock = stock;
    }

    public async Task CancelarVendaAsync(Guid vendaId, Guid usuarioId, string motivo, CancellationToken ct = default)
    {
        var venda = await _db.Vendas.Include(v => v.Itens).SingleOrDefaultAsync(v => v.Id == vendaId, ct)
            ?? throw new VendaInvalidaException("Venda não encontrada.");

        if (venda.Cancelada)
            throw new VendaInvalidaException("Venda já está cancelada.");

        foreach (var item in venda.Itens)
        {
            await _stock.DevolverEstoqueAsync(item.ProdutoId, item.Quantidade, usuarioId,
                TipoMovimentoEstoque.CancelamentoVenda, venda.ComandaId, null,
                $"Estorno da venda {venda.Id}: {motivo}", ct);
        }

        venda.Cancelada = true;
        venda.CanceladaEm = DateTime.UtcNow;
        venda.CanceladaPorUsuarioId = usuarioId;
        venda.MotivoCancelamento = motivo;

        _db.AuditLogs.Add(new AuditLog
        {
            UsuarioId = usuarioId,
            Acao = "CANCELOU_VENDA",
            Entidade = nameof(Venda),
            EntidadeId = venda.Id,
            DadosJson = $"Venda {venda.Id} cancelada/estornada. Motivo: {motivo}",
            DataHora = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);
    }
}
