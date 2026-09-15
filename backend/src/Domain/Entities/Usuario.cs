using Pdv.Domain.Enums;

namespace Pdv.Domain.Entities;

public class Usuario : EntidadeBase
{
    public string Nome { get; set; } = default!;
    public string Login { get; set; } = default!;
    public string SenhaHash { get; set; } = default!;
    public PerfilUsuario Perfil { get; set; }
    public bool Ativo { get; set; } = true;
    public DateTime? UltimoAcesso { get; set; }
}
