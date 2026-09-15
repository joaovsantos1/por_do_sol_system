namespace Pdv.Domain.Entities;

public class Categoria : EntidadeBase
{
    public string Nome { get; set; } = default!;
    public bool Ativo { get; set; } = true;
    public ICollection<Produto> Produtos { get; set; } = new List<Produto>();
}

public class Produto : EntidadeBase
{
    public string Codigo { get; set; } = default!;
    public string? CodigoBarras { get; set; }
    public string Nome { get; set; } = default!;
    public string? Descricao { get; set; }
    public Guid CategoriaId { get; set; }
    public Categoria? Categoria { get; set; }
    public decimal PrecoVenda { get; set; }
    public decimal PrecoCusto { get; set; }

    /// <summary>
    /// Estoque atual. Fonte da verdade é sempre a soma dos MovimentosEstoque;
    /// esta coluna é uma projeção materializada mantida dentro da MESMA
    /// transação de cada movimento, para leitura rápida sem recalcular a soma
    /// a cada consulta do PDV. Nunca é alterada fora de uma transação que
    /// também grava um MovimentoEstoque (ver StockService).
    /// </summary>
    public int EstoqueAtual { get; set; }
    public int EstoqueMinimo { get; set; }
    public string Unidade { get; set; } = "UN";
    public bool Ativo { get; set; } = true;
    public string? ImagemUrl { get; set; }
}
