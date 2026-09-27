using Pdv.Domain.Enums;

namespace Pdv.Domain.Entities;

/// <summary>
/// Registro imutável de cada alteração de estoque. Nunca é atualizado ou
/// apagado — apenas inserido. É o histórico/auditoria de estoque e também
/// permite recalcular o EstoqueAtual do produto a qualquer momento
/// (soma de Entradas/Devolucao - SaidaVenda/Ajuste negativo, etc.) caso
/// seja necessário conferir consistência.
/// </summary>
public class MovimentoEstoque : EntidadeBase
{
    public Guid ProdutoId { get; set; }
    public Produto? Produto { get; set; }
    public TipoMovimentoEstoque Tipo { get; set; }

    /// <summary>Positivo para entradas/devoluções, negativo para saídas/ajustes de baixa.</summary>
    public int Quantidade { get; set; }

    public int EstoqueResultante { get; set; }
    public Guid? ComandaId { get; set; }
    public Guid? ComandaItemId { get; set; }
    public Guid UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }
    public string? Observacao { get; set; }

    /// <summary>
    /// Preenchido só em movimentos de ENTRADA quando o operador informa o
    /// preço de custo pago naquela compra. Como o custo de um mesmo produto
    /// pode mudar de uma compra pra outra, isso funciona como o histórico
    /// de custo do produto — dá pra consultar todas as entradas com esse
    /// campo preenchido, em ordem cronológica, e ver quanto se pagava antes
    /// vs. quanto se paga hoje. Quando informado, também atualiza
    /// Produto.PrecoCusto (ver StockService.DevolverEstoqueAsync).
    /// </summary>
    public decimal? PrecoCustoRegistrado { get; set; }
}
