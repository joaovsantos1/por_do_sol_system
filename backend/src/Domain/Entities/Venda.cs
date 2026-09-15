using Pdv.Domain.Enums;

namespace Pdv.Domain.Entities;

/// <summary>
/// Representa a venda finalizada, independente da Comanda. Criada no momento
/// do fechamento e nunca mais alterada (exceto pelo fluxo formal de
/// cancelamento/estorno). Relatórios e dashboard consultam Venda/VendaItem,
/// não Comanda/ComandaItem, para não depender de dados que podem mudar
/// (comandas continuam existindo como "documento operacional" do caixa).
/// </summary>
public class Venda : EntidadeBase
{
    public Guid ComandaId { get; set; }
    public Comanda? Comanda { get; set; }
    public Guid UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }
    public DateTime DataHora { get; set; } = DateTime.UtcNow;
    public decimal Desconto { get; set; }
    public decimal Total { get; set; }
    public bool Cancelada { get; set; }
    public DateTime? CanceladaEm { get; set; }
    public Guid? CanceladaPorUsuarioId { get; set; }
    public string? MotivoCancelamento { get; set; }

    public ICollection<VendaItem> Itens { get; set; } = new List<VendaItem>();
    public ICollection<Pagamento> Pagamentos { get; set; } = new List<Pagamento>();
}

public class VendaItem : EntidadeBase
{
    public Guid VendaId { get; set; }
    public Venda? Venda { get; set; }
    public Guid ProdutoId { get; set; }
    public Produto? Produto { get; set; }
    public string ProdutoNomeSnapshot { get; set; } = default!;
    public int Quantidade { get; set; }
    public decimal PrecoUnitario { get; set; }
    public decimal Subtotal { get; set; }
}

public class Pagamento : EntidadeBase
{
    public Guid ComandaId { get; set; }
    public Comanda? Comanda { get; set; }
    public Guid? VendaId { get; set; }
    public Venda? Venda { get; set; }
    public FormaPagamento Forma { get; set; }
    public decimal Valor { get; set; }
    public DateTime DataHora { get; set; } = DateTime.UtcNow;
    public Guid UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }
}
