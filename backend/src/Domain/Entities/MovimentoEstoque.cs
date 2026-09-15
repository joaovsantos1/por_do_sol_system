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
}
