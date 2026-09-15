using Pdv.Domain.Enums;

namespace Pdv.Domain.Entities;

public class Meta : EntidadeBase
{
    public TipoMeta Tipo { get; set; }
    public DateTime PeriodoInicio { get; set; }
    public DateTime PeriodoFim { get; set; }
    public decimal ValorAlvo { get; set; }
    public string? Descricao { get; set; }
}

/// <summary>
/// Log de auditoria imutável (append-only). Uma linha por ação relevante,
/// como "Usuário João abriu comanda 152".
/// </summary>
public class AuditLog : EntidadeBase
{
    public Guid UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }
    public string Acao { get; set; } = default!;
    public string Entidade { get; set; } = default!;
    public Guid EntidadeId { get; set; }
    public string? DadosJson { get; set; }
    public DateTime DataHora { get; set; } = DateTime.UtcNow;
}
