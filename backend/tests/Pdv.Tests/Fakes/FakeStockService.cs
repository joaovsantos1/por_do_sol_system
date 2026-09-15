using Pdv.Domain.Entities;
using Pdv.Domain.Enums;
using Pdv.Infrastructure.Services;

namespace Pdv.Tests.Fakes;

/// <summary>
/// Fake em memória do IStockService, usado para testar as REGRAS DE
/// NEGÓCIO de ComandaService/FechamentoService isoladamente, sem depender
/// de PostgreSQL real (o EF InMemory não suporta "FOR UPDATE"). O teste da
/// concorrência de verdade (lock pessimista) está em
/// StockServiceConcurrencyTests, que precisa de um PostgreSQL real
/// (via Testcontainers) — ver README dos testes.
/// </summary>
public class FakeStockService : IStockService
{
    public Dictionary<Guid, int> Estoque { get; } = new();
    public List<(Guid ProdutoId, int Quantidade)> Movimentos { get; } = new();

    public Task<MovimentoEstoque> BaixarEstoqueAsync(Guid produtoId, int quantidade, Guid usuarioId, TipoMovimentoEstoque tipo, Guid? comandaId, Guid? comandaItemId, string? observacao, CancellationToken ct = default)
    {
        var atual = Estoque.GetValueOrDefault(produtoId, 0);
        if (atual < quantidade)
            throw new EstoqueInsuficienteException("Produto", atual, quantidade);

        Estoque[produtoId] = atual - quantidade;
        Movimentos.Add((produtoId, -quantidade));
        return Task.FromResult(new MovimentoEstoque { ProdutoId = produtoId, Quantidade = -quantidade, EstoqueResultante = Estoque[produtoId] });
    }

    public Task<MovimentoEstoque> DevolverEstoqueAsync(Guid produtoId, int quantidade, Guid usuarioId, TipoMovimentoEstoque tipo, Guid? comandaId, Guid? comandaItemId, string? observacao, CancellationToken ct = default)
    {
        var atual = Estoque.GetValueOrDefault(produtoId, 0);
        Estoque[produtoId] = atual + quantidade;
        Movimentos.Add((produtoId, quantidade));
        return Task.FromResult(new MovimentoEstoque { ProdutoId = produtoId, Quantidade = quantidade, EstoqueResultante = Estoque[produtoId] });
    }

    public async Task AjustarQuantidadeAsync(Guid produtoId, int quantidadeAntiga, int quantidadeNova, Guid usuarioId, Guid comandaId, Guid comandaItemId, CancellationToken ct = default)
    {
        var diferenca = quantidadeNova - quantidadeAntiga;
        if (diferenca == 0) return;
        if (diferenca > 0)
            await BaixarEstoqueAsync(produtoId, diferenca, usuarioId, TipoMovimentoEstoque.SaidaVenda, comandaId, comandaItemId, null, ct);
        else
            await DevolverEstoqueAsync(produtoId, -diferenca, usuarioId, TipoMovimentoEstoque.Devolucao, comandaId, comandaItemId, null, ct);
    }
}
