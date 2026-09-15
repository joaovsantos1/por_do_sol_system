namespace Pdv.Domain.Entities;

/// <summary>
/// Base para todas as entidades. CreatedAt/UpdatedAt para auditoria simples;
/// RowVersion habilita concorrência otimista via EF Core (token de concorrência)
/// para entidades onde locking otimista é suficiente (ex.: cadastros).
/// Para o fluxo crítico de estoque, usamos concorrência pessimista via
/// transação + SELECT ... FOR UPDATE (ver StockService), não apenas RowVersion.
/// </summary>
public abstract class EntidadeBase
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // [System.ComponentModel.DataAnnotations.Timestamp]
    // public uint RowVersion { get; set; }
}
