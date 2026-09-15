using Microsoft.EntityFrameworkCore;
using Pdv.Domain.Entities;
using Pdv.Domain.Enums;
using Pdv.Infrastructure.Data;
using Pdv.Infrastructure.Services;

namespace Pdv.Application.Comandas;

public class PagamentoInsuficienteException : Exception
{
    public PagamentoInsuficienteException(decimal total, decimal pago)
        : base($"Soma dos pagamentos (R$ {pago:F2}) é menor que o total da comanda (R$ {total:F2}).") { }
}

public class FechamentoService
{
    private readonly PdvDbContext _db;

    public FechamentoService(PdvDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Fecha a comanda: valida que a soma dos pagamentos (inclusive misto,
    /// ex.: parte PIX + parte dinheiro) cobre o total, registra cada
    /// pagamento individualmente, gera a Venda/VendaItem (estrutura própria,
    /// independente da Comanda, para relatórios) e marca a comanda como
    /// Fechada. Tudo em uma única transação de banco.
    /// </summary>
    public async Task<Venda> FecharComandaAsync(Guid comandaId, List<(FormaPagamento Forma, decimal Valor)> pagamentos, Guid usuarioId, CancellationToken ct = default)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            var comanda = await _db.Comandas
                .Include(c => c.Itens.Where(i => !i.Removido))
                .ThenInclude(i => i.Produto)
                .SingleOrDefaultAsync(c => c.Id == comandaId, ct)
                ?? throw new ComandaInvalidaException("Comanda não encontrada.");

            if (comanda.Status != StatusComanda.Aberta)
                throw new ComandaInvalidaException("Somente comandas abertas podem ser fechadas.");

            if (!comanda.Itens.Any(i => !i.Removido))
                throw new ComandaInvalidaException("Comanda não possui itens para fechar.");

            var totalPago = pagamentos.Sum(p => p.Valor);
            if (totalPago < comanda.ValorTotal)
                throw new PagamentoInsuficienteException(comanda.ValorTotal, totalPago);

            var venda = new Venda
            {
                ComandaId = comanda.Id,
                UsuarioId = usuarioId,
                DataHora = DateTime.UtcNow,
                Total = comanda.ValorTotal
            };

            foreach (var item in comanda.Itens.Where(i => !i.Removido))
            {
                venda.Itens.Add(new VendaItem
                {
                    ProdutoId = item.ProdutoId,
                    ProdutoNomeSnapshot = item.Produto!.Nome,
                    Quantidade = item.Quantidade,
                    PrecoUnitario = item.PrecoUnitario,
                    Subtotal = item.Subtotal
                });
            }

            foreach (var (forma, valor) in pagamentos)
            {
                var pagamento = new Pagamento
                {
                    ComandaId = comanda.Id,
                    Forma = forma,
                    Valor = valor,
                    DataHora = DateTime.UtcNow,
                    UsuarioId = usuarioId
                };
                comanda.Pagamentos.Add(pagamento);
                venda.Pagamentos.Add(pagamento);
            }

            comanda.Status = StatusComanda.Fechada;
            comanda.FechadaEm = DateTime.UtcNow;
            comanda.FechadaPorUsuarioId = usuarioId;
            comanda.UpdatedAt = DateTime.UtcNow;

            _db.Vendas.Add(venda);

            _db.AuditLogs.Add(new AuditLog
            {
                UsuarioId = usuarioId,
                Acao = "FECHOU_COMANDA",
                Entidade = nameof(Comanda),
                EntidadeId = comanda.Id,
                DadosJson = $"Comanda {comanda.CodigoIdentificador} fechada. Total R$ {comanda.ValorTotal:F2}, pago R$ {totalPago:F2}.",
                DataHora = DateTime.UtcNow
            });

            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return venda;
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }
}
