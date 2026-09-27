using System.Numerics;
using Microsoft.CodeAnalysis.Host;
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

public class DescontoInvalidoException : Exception
{
    public DescontoInvalidoException(string mensagem) : base(mensagem) { }
}

public class FechamentoService
{
    private readonly PdvDbContext _db;

    public FechamentoService(PdvDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Fecha a comanda: aplica desconto (opcional), valida que a soma dos
    /// pagamentos (inclusive misto, ex.: parte PIX + parte dinheiro) cobre
    /// o total JÁ COM DESCONTO, registra cada pagamento individualmente,
    /// gera a Venda/VendaItem (estrutura própria, independente da Comanda,
    /// para relatórios) e marca a comanda como Fechada. Tudo em uma única
    /// transação de banco.
    /// </summary>
    public async Task<Venda> FecharComandaAsync(Guid comandaId, List<(FormaPagamento Forma, decimal Valor)> pagamentos, Guid usuarioId, CancellationToken ct = default, decimal desconto = 0)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            var comanda = await _db.Comandas
                .Include(c => c.Itens.Where(i => !i.Removido))
                .ThenInclude(i => i.Produto)
                .SingleOrDefaultAsync(c => c.Id == comandaId, ct)
                ?? throw new ComandaInvalidaException("Comanda não encontrada.");

            // Rede de segurança contra o bug de concorrência já corrigido no
            // ComandaService: se esta comanda tiver ficado com um ValorTotal
            // desatualizado (de antes da correção), recalcula aqui antes de
            // fechar, em vez de confiar cegamente no campo.
            comanda.ValorTotal = comanda.Itens.Where(i => !i.Removido).Sum(i => i.Subtotal);

            if (comanda.Status != StatusComanda.Aberta)
                throw new ComandaInvalidaException("Somente comandas abertas podem ser fechadas.");

            if (!comanda.Itens.Any(i => !i.Removido))
                throw new ComandaInvalidaException("Comanda não possui itens para fechar.");

            if (desconto < 0)
                throw new DescontoInvalidoException("Desconto não pode ser negativo.");
            if (desconto > comanda.ValorTotal)
                throw new DescontoInvalidoException("Desconto não pode ser maior que total da comanda.");

            var totalAPagar = comanda.ValorTotal - desconto;

            var totalPago = pagamentos.Sum(p => p.Valor);
            if (totalPago < totalAPagar)
                throw new PagamentoInsuficienteException(totalAPagar, totalPago);

            var venda = new Venda
            {
                ComandaId = comanda.Id,
                UsuarioId = usuarioId,
                DataHora = DateTime.UtcNow,
                Desconto = desconto,
                Total = totalAPagar
            };

            foreach (var item in comanda.Itens.Where(i => !i.Removido))
            {
                venda.Itens.Add(new VendaItem
                {
                    ProdutoId = item.ProdutoId,
                    ProdutoNomeSnapshot = item.ComboNomeSnapshot is not null
                        ? $"{item.Produto!.Nome} (combo: {item.ComboNomeSnapshot})"
                        : item.Produto!.Nome,
                    Quantidade = item.Quantidade,
                    PrecoUnitario = item.PrecoUnitario,
                    Subtotal = item.Subtotal
                });
            }

            var configTaxas = await _db.ConfiguracoesTaxas.AsNoTracking().FirstOrDefaultAsync(ct);
            var taxaCredito = configTaxas?.TaxaCartaoCreditoPercentual ?? 0m;
            var taxaDebito = configTaxas?.TaxaCartaoDebitoPercentual ?? 0m;

            foreach (var (forma, valor) in pagamentos)
            {
                // Desconta a taxa da maquininha e guarda o valor líquido —
                // é esse número que precisa bater com o extrato da
                // maquininha nos relatórios financeiros. Pix/Dinheiro não
                // têm taxa, então o líquido é igual ao valor bruto.
                var valorLiquido = forma switch
                {
                    FormaPagamento.CartaoCredito => Math.Round(valor * (1 - taxaCredito / 100m), 2),
                    FormaPagamento.CartaoDebito => Math.Round(valor * (1 - taxaDebito / 100m), 2),
                    _ => valor // Pix, Dinheiro e o legado "Cartao" não tem taxa rastreada
                };

                var pagamento = new Pagamento
                {
                    ComandaId = comanda.Id,
                    Forma = forma,
                    Valor = valor,
                    ValorLiquido = valorLiquido,
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
                DadosJson = $"Comanda {comanda.CodigoIdentificador} fechada. Total R$ {comanda.ValorTotal:F2}, pago R$ {totalPago:F2}." +
                    (desconto > 0 ? $", desconto R$ {desconto:F2}" : "") +
                    $", pago R$ {totalPago:F2}.",
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
