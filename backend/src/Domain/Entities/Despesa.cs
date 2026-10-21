namespace Pdv.Domain.Entities;

public class CategoriaDespesa : EntidadeBase
{
    public string Nome { get; set; } = default!;
    public bool Ativo { get; set; } = true;
}

public class Despesa : EntidadeBase
{
    public string Descricao { get; set; } = default!;
    public decimal Valor { get; set; }

    /// <summary>Data em que a despesa ocorreu (pode ser diferente da data de
    /// cadastro — ex.: lançar hoje uma conta que venceu ontem).</summary>
    public DateTime Data { get; set; }

    public Guid CategoriaDespesaId { get; set; }
    public CategoriaDespesa? CategoriaDespesa { get; set; }

    public Guid UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }

    public string? Observacao { get; set; }
}