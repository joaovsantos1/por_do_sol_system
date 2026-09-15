using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Pdv.Domain.Entities;
using Pdv.Domain.Enums;

namespace Pdv.Infrastructure.Services;

public interface IStockService
{
    Task<Pdv.Domain.Entities.MovimentoEstoque> BaixarEstoqueAsync(
        Guid produtoId, int quantidade, Guid usuarioId,
        Pdv.Domain.Enums.TipoMovimentoEstoque tipo, Guid? comandaId, Guid? comandaItemId,
        string? observacao, CancellationToken ct = default);

    Task<Pdv.Domain.Entities.MovimentoEstoque> DevolverEstoqueAsync(
        Guid produtoId, int quantidade, Guid usuarioId,
        Pdv.Domain.Enums.TipoMovimentoEstoque tipo, Guid? comandaId, Guid? comandaItemId,
        string? observacao, CancellationToken ct = default);

    Task AjustarQuantidadeAsync(
        Guid produtoId, int quantidadeAntiga, int quantidadeNova,
        Guid usuarioId, Guid comandaId, Guid comandaItemId, CancellationToken ct = default);
}

public class EstoqueInsuficienteException : Exception
{
    public EstoqueInsuficienteException(string produtoNome, int disponivel, int solicitado)
        : base($"Estoque insuficiente para '{produtoNome}'. Disponível: {disponivel}, solicitado: {solicitado}.") { }
}

public class ComandaInvalidaException : Exception
{
    public ComandaInvalidaException(string mensagem) : base(mensagem) { }
}

/// <summary>
/// Centraliza TODA alteração de estoque decorrente de comandas.
///
/// PROBLEMA: dois ou mais usuários podem tentar consumir a última unidade de
/// um produto ao mesmo tempo, em comandas diferentes (race condition clássica
/// de leitura-depois-escrita: ambos leem estoque=1, ambos decidem que podem
/// vender, ambos gravam estoque=0, e o sistema vendeu 2 unidades de 1
/// disponível).
///
/// SOLUÇÃO ESCOLHIDA: concorrência PESSIMISTA via lock de linha no PostgreSQL.
/// Abrimos uma transação e executamos
///   SELECT ... FROM "Produtos" WHERE "Id" = @id FOR UPDATE
/// antes de ler o EstoqueAtual. O FOR UPDATE faz com que a segunda transação
/// concorrente para o MESMO produto fique bloqueada aguardando a primeira
/// commitar (ou reverter) antes de conseguir ler a linha — ela não lê um
/// valor "estale". Assim, a segunda transação sempre enxerga o estoque já
/// atualizado pela primeira, e a validação de quantidade disponível é
/// sempre feita sobre um dado correto.
///
/// POR QUE NÃO otimista (RowVersion) aqui: com otimista, a segunda transação
/// seria REJEITADA depois de já ter feito todo o trabalho (calcular total,
/// validar comanda, etc.), exigindo retry manual e piorando a experiência no
/// PDV sob alta concorrência no mesmo produto (ex.: hora do rush). Pessimista
/// evita o retry: a segunda operação simplesmente espera alguns milissegundos
/// na fila do lock e prossegue com dado correto. Como cada operação é curta
/// (poucas queries), o tempo de espera é desprezível.
///
/// IMPACTO: todo acesso a EstoqueAtual para fins de venda DEVE passar por
/// este serviço (nunca alterar Produto.EstoqueAtual diretamente em outro
/// lugar do código), senão o lock pessimista perde efeito.
/// </summary>
public class StockService : IStockService
{
    private readonly Pdv.Infrastructure.Data.PdvDbContext _db;

    public StockService(Pdv.Infrastructure.Data.PdvDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Baixa estoque de forma segura contra concorrência. Lança
    /// EstoqueInsuficienteException se não houver quantidade disponível.
    /// Deve ser chamado dentro do fluxo de adicionar/aumentar item de comanda.
    /// </summary>
    public async Task<MovimentoEstoque> BaixarEstoqueAsync(
        Guid produtoId, int quantidade, Guid usuarioId,
        TipoMovimentoEstoque tipo, Guid? comandaId, Guid? comandaItemId,
        string? observacao, CancellationToken ct = default)
    {
        if (quantidade <= 0) throw new ArgumentException("Quantidade deve ser positiva.", nameof(quantidade));

        await using IDbContextTransaction tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            // Lock pessimista de linha: bloqueia até que qualquer outra transação
            // concorrente sobre o MESMO produto termine (commit/rollback).
            var produto = await _db.Produtos
                .FromSqlRaw(@"SELECT * FROM ""Produtos"" WHERE ""Id"" = {0} FOR UPDATE", produtoId)
                .SingleOrDefaultAsync(ct);

            if (produto is null)
                throw new ComandaInvalidaException("Produto não encontrado.");

            if (produto.EstoqueAtual < quantidade)
                throw new EstoqueInsuficienteException(produto.Nome, produto.EstoqueAtual, quantidade);

            produto.EstoqueAtual -= quantidade;
            produto.UpdatedAt = DateTime.UtcNow;

            var movimento = new MovimentoEstoque
            {
                ProdutoId = produtoId,
                Tipo = tipo,
                Quantidade = -quantidade,
                EstoqueResultante = produto.EstoqueAtual,
                ComandaId = comandaId,
                ComandaItemId = comandaItemId,
                UsuarioId = usuarioId,
                Observacao = observacao
            };
            _db.MovimentosEstoque.Add(movimento);

            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return movimento;
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    /// <summary>
    /// Devolve estoque (remoção de item, redução de quantidade, cancelamento
    /// de comanda/venda). Mesmo mecanismo de lock, mas sem risco de ficar
    /// negativo — sempre soma.
    /// </summary>
    public async Task<MovimentoEstoque> DevolverEstoqueAsync(
        Guid produtoId, int quantidade, Guid usuarioId,
        TipoMovimentoEstoque tipo, Guid? comandaId, Guid? comandaItemId,
        string? observacao, CancellationToken ct = default)
    {
        if (quantidade <= 0) throw new ArgumentException("Quantidade deve ser positiva.", nameof(quantidade));

        await using IDbContextTransaction tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            var produto = await _db.Produtos
                .FromSqlRaw(@"SELECT * FROM ""Produtos"" WHERE ""Id"" = {0} FOR UPDATE", produtoId)
                .SingleOrDefaultAsync(ct);

            if (produto is null)
                throw new ComandaInvalidaException("Produto não encontrado.");

            produto.EstoqueAtual += quantidade;
            produto.UpdatedAt = DateTime.UtcNow;

            var movimento = new MovimentoEstoque
            {
                ProdutoId = produtoId,
                Tipo = tipo,
                Quantidade = quantidade,
                EstoqueResultante = produto.EstoqueAtual,
                ComandaId = comandaId,
                ComandaItemId = comandaItemId,
                UsuarioId = usuarioId,
                Observacao = observacao
            };
            _db.MovimentosEstoque.Add(movimento);

            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return movimento;
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    /// <summary>
    /// Ajusta a baixa quando a quantidade de um item já existente na comanda
    /// muda: baixa somente a diferença (aumento) ou devolve somente a
    /// diferença (redução). Usa o mesmo lock pessimista por produto.
    /// </summary>
    public async Task AjustarQuantidadeAsync(
        Guid produtoId, int quantidadeAntiga, int quantidadeNova,
        Guid usuarioId, Guid comandaId, Guid comandaItemId, CancellationToken ct = default)
    {
        var diferenca = quantidadeNova - quantidadeAntiga;
        if (diferenca == 0) return;

        if (diferenca > 0)
        {
            await BaixarEstoqueAsync(produtoId, diferenca, usuarioId,
                TipoMovimentoEstoque.SaidaVenda, comandaId, comandaItemId,
                "Aumento de quantidade em item de comanda", ct);
        }
        else
        {
            await DevolverEstoqueAsync(produtoId, -diferenca, usuarioId,
                TipoMovimentoEstoque.Devolucao, comandaId, comandaItemId,
                "Redução de quantidade em item de comanda", ct);
        }
    }
}
