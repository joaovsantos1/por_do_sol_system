using Pdv.Domain.Enums;

namespace Pdv.Domain.Entities;

public class Combo : EntidadeBase
{
    public string Nome { get; set; } = default!;
    public string? Descricao { get; set; }
    public decimal PrecoVenda { get; set; }
    public bool Ativo { get; set; } = true;

    public ICollection<ComboItem> Itens { get; set; } = new List<ComboItem>();
}

public class ComboItem : EntidadeBase
{
    public Guid ComboId { get; set; }
    public Combo? Combo { get; set; }

    public Guid ProdutoId { get; set; }
    public Produto? Produto { get; set; }

    /// <summary>Quantidade desse produto necessária para UM combo (ex.: 1 salgado + 1 refri).</summary>
    public int Quantidade { get; set; }
}

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

    /// <summary>Preenchido quando este item faz parte de um combo/kit
    /// vendido (ex.: "Salgado + Refri"). Todos os itens do mesmo combo
    /// compartilham o mesmo GrupoComboId, o que permite remover o combo
    /// inteiro de uma vez e mostrar visualmente que estão agrupados.
    /// O PrecoUnitario/Subtotal aqui já vêm com o preço promocional
    /// (recalculado proporcionalmente a partir do PrecoVenda normal do
    /// produto) — NUNCA o preço avulso normal.</summary>
    public Guid? GrupoComboId { get; set; }

    /// <summary>Nome do combo no momento da venda (snapshot) — não referencia
    /// o Combo por FK aqui de propósito, pra manter o histórico da comanda
    /// legível mesmo se o combo for editado/inativado depois.</summary>
    public string? ComboNomeSnapshot { get; set; }

    /// <summary>True quando o item foi removido da comanda (mantido para histórico/auditoria em vez de exclusão física).</summary>
    public bool Removido { get; set; }
}
