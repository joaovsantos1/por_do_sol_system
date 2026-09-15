using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Pdv.Api.Hubs;

/// <summary>
/// Notifica clientes conectados sobre mudanças em comandas (aberta,
/// item adicionado/removido, fechada) para que a tela "Comandas Abertas"
/// e o PDV de outros usuários atualizem sem polling.
/// </summary>
[Authorize]
public class ComandasHub : Hub
{
}

/// <summary>
/// Notifica sobre mudanças de estoque (para refletir estoque baixo e
/// disponibilidade no PDV em tempo real).
/// </summary>
[Authorize]
public class EstoqueHub : Hub
{
}
