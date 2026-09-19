using Pdv.Domain.Enums;

namespace Pdv.Domain.Entities;

public class Comanda : EntidadeBase
{
    /// <summary>Número sequencial legível, ex.: 152 -> exibido como "COMANDA-000152".</summary>
    public int Numero { get; set; }

    /// <summary>Código identificador único usado no QR Code / código de barras (ex.: "COMANDA-000152").</summary>
    public string CodigoIdentificador { get; set; } = default!;

    public int? NumeroMesa { get; set; }

    public string? NomeCliente { get; set; }

    public StatusComanda Status { get; set; } = StatusComanda.Aberta;

    public DateTime AbertaEm { get; set; } = DateTime.UtcNow;
    public Guid AbertaPorUsuarioId { get; set; }
    public Usuario? AbertaPorUsuario { get; set; }

    public DateTime? FechadaEm { get; set; }
    public Guid? FechadaPorUsuarioId { get; set; }
    public Usuario? FechadaPorUsuario { get; set; }

    public decimal ValorTotal { get; set; }
    public string? Observacoes { get; set; }

    public ICollection<ComandaItem> Itens { get; set; } = new List<ComandaItem>();
    public ICollection<Pagamento> Pagamentos { get; set; } = new List<Pagamento>();
}

public class ComandaItem : EntidadeBase
{
    public Guid ComandaId { get; set; }
    public Comanda? Comanda { get; set; }

    public Guid ProdutoId { get; set; }
    public Produto? Produto { get; set; }

    public int Quantidade { get; set; }
    public decimal PrecoUnitario { get; set; }
    public decimal Subtotal { get; set; }

    /// <summary>True quando o item foi removido da comanda (mantido para histórico/auditoria em vez de exclusão física).</summary>
    public bool Removido { get; set; }
}
