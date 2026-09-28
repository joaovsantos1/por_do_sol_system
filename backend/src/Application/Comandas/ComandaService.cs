using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Pdv.Domain.Entities;
using Pdv.Domain.Enums;
using Pdv.Infrastructure.Data;
using Pdv.Infrastructure.Services;

namespace Pdv.Application.Comandas;

public class ComandaService
{
    private readonly PdvDbContext _db;
    private readonly IStockService _stock;

    public ComandaService(PdvDbContext db, IStockService stock)
    {
        _db = db;
        _stock = stock;
    }

    /// <summary>
    /// Carrega a comanda com lock pessimista de linha (mesma técnica do
    /// StockService para produtos) — serializa qualquer outra operação
    /// concorrente na MESMA comanda, evitando que duas ações (ex.: dois
    /// cliques rápidos, duas abas abertas) leiam um ValorTotal desatualizado
    /// e sobrescrevam o cálculo uma da outra.
    /// </summary>
    private async Task<Comanda> LockComandaAsync(Guid comandaId, CancellationToken ct)
    {
        return await _db.Comandas
            .FromSqlRaw(@"SELECT * FROM ""Comandas"" WHERE ""Id"" = {0} FOR UPDATE", comandaId)
            .SingleOrDefaultAsync(ct)
            ?? throw new ComandaInvalidaException("Comanda não encontrada.");
    }

    /// <summary>
    /// Recalcula o ValorTotal do ZERO, somando os itens ativos — nunca
    /// incrementa/decrementa um valor anterior. Isso torna o total sempre
    /// correto e autocorretivo (se algo já tiver ficado inconsistente antes
    /// desta correção, a próxima operação na comanda já conserta sozinha).
    /// </summary>
    private async Task<decimal> RecalcularTotalAsync(Guid comandaId, CancellationToken ct)
    {
        return await _db.ComandaItens
            .Where(i => i.ComandaId == comandaId && !i.Removido)
            .SumAsync(i => (decimal?)i.Subtotal, ct) ?? 0m;
    }
    public async Task<Comanda> AbrirComandaAsync(Guid usuarioId, string? observacoes, int? numeroMesa, string? nomeCliente, CancellationToken ct = default)
    {
        // Número sequencial simples baseado no maior número existente.
        // Em volume muito alto, trocar por uma sequence do PostgreSQL;
        // para uma única loja o volume de comandas/dia não justifica isso.
        var ultimoNumero = await _db.Comandas
            .OrderByDescending(c => c.Numero)
            .Select(c => c.Numero)
            .FirstOrDefaultAsync(ct);

        var numero = ultimoNumero + 1;
        var comanda = new Comanda
        {
            Numero = numero,
            CodigoIdentificador = $"COMANDA-{numero:D6}",
            Status = StatusComanda.Aberta,
            AbertaEm = DateTime.UtcNow,
            AbertaPorUsuarioId = usuarioId,
            Observacoes = observacoes,
            NumeroMesa = numeroMesa,
            NomeCliente = nomeCliente
        };

        _db.Comandas.Add(comanda);
        await _db.SaveChangesAsync(ct);

        await RegistrarAuditoriaAsync(usuarioId, "ABRIU_COMANDA", nameof(Comanda), comanda.Id,
            $"Comanda {comanda.CodigoIdentificador} aberta", ct);

        return comanda;
    }

    /// <summary>
    /// Fluxo completo de inclusão de item, seguindo exatamente os passos
    /// exigidos: valida comanda, valida status, valida produto, baixa
    /// estoque com lock pessimista (StockService), registra item.
    /// Tudo dentro de uma única transação lógica: se qualquer etapa falhar
    /// (inclusive a baixa de estoque por falta de quantidade), nada é
    /// persistido — a exceção interrompe antes do SaveChanges final e o
    /// item da comanda não é criado.
    /// </summary>
    public async Task<ComandaItem> AdicionarItemAsync(Guid comandaId, Guid produtoId, int quantidade, Guid usuarioId, CancellationToken ct = default)
    {
        if (quantidade <= 0) throw new ArgumentException("Quantidade deve ser maior que zero.");

        await using IDbContextTransaction tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            var comanda = await LockComandaAsync(comandaId, ct);

            if (comanda.Status != StatusComanda.Aberta)
                throw new ComandaInvalidaException("Comanda não está aberta.");

            var produto = await _db.Produtos.AsNoTracking().SingleOrDefaultAsync(p => p.Id == produtoId, ct)
                ?? throw new ComandaInvalidaException("Produto não encontrado.");

            if (!produto.Ativo)
                throw new ComandaInvalidaException("Produto inativo.");

            var itemExistente = await _db.ComandaItens.SingleOrDefaultAsync(
                i => i.ComandaId == comandaId && i.ProdutoId == produtoId && !i.Removido && i.GrupoComboId == null, ct);

            var itemId = itemExistente?.Id ?? Guid.NewGuid();

            await _stock.BaixarEstoqueAsync(
                produtoId, quantidade, usuarioId, TipoMovimentoEstoque.SaidaVenda,
                comandaId, itemId, $"Item adicionado na comanda {comanda.CodigoIdentificador}", ct);

            ComandaItem item;
            if (itemExistente is not null)
            {
                itemExistente.Quantidade += quantidade;
                itemExistente.Subtotal = itemExistente.PrecoUnitario * itemExistente.Quantidade;
                item = itemExistente;
            }
            else
            {

                item = new ComandaItem
                {
                    Id = itemId,
                    ComandaId = comandaId,
                    ProdutoId = produtoId,
                    Quantidade = quantidade,
                    PrecoUnitario = produto.PrecoVenda,
                    Subtotal = produto.PrecoVenda * quantidade
                };
                _db.ComandaItens.Add(item);
            }
            await _db.SaveChangesAsync(ct);

            comanda.ValorTotal = await RecalcularTotalAsync(comandaId, ct);
            comanda.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            await RegistrarAuditoriaAsync(usuarioId, "ADICIONOU_ITEM", nameof(Comanda), comandaId,
                $"{quantidade}x {produto.Nome} adicionado(s) na comanda {comanda.CodigoIdentificador}", ct);

            return item;
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }
    public async Task AlterarQuantidadeAsync(Guid comandaId, Guid itemId, int novaQuantidade, Guid usuarioId, CancellationToken ct = default)
    {
        if (novaQuantidade <= 0) throw new ArgumentException("Use remover item em vez de quantidade zero.");

        await using IDbContextTransaction tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            var comanda = await LockComandaAsync(comandaId, ct);
            if (comanda.Status != StatusComanda.Aberta)
                throw new ComandaInvalidaException("Comanda não está aberta.");

            var item = await _db.ComandaItens.SingleOrDefaultAsync(i => i.Id == itemId && i.ComandaId == comandaId, ct)
                ?? throw new ComandaInvalidaException("Item não encontrado.");
            if (item.Removido) throw new ComandaInvalidaException("Item já foi removido.");

            var quantidadeAntiga = item.Quantidade;

            // Ajusta estoque apenas pela diferença (aumenta baixa ou devolve a diferença).
            await _stock.AjustarQuantidadeAsync(item.ProdutoId, quantidadeAntiga, novaQuantidade, usuarioId, comandaId, itemId, ct);

            item.Quantidade = novaQuantidade;
            item.Subtotal = item.PrecoUnitario * novaQuantidade;
            await _db.SaveChangesAsync(ct);

            comanda.ValorTotal = await RecalcularTotalAsync(comandaId, ct);
            comanda.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            await tx.CommitAsync(ct);

            await RegistrarAuditoriaAsync(usuarioId, "ALTEROU_QUANTIDADE", nameof(Comanda), comandaId,
                $"Item {itemId} alterado de {quantidadeAntiga} para {novaQuantidade}", ct);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }
    public async Task RemoverItemAsync(Guid comandaId, Guid itemId, Guid usuarioId, CancellationToken ct = default)
    {
        await using IDbContextTransaction tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            var comanda = await LockComandaAsync(comandaId, ct);
            if (comanda.Status != StatusComanda.Aberta)
                throw new ComandaInvalidaException("Comanda não está aberta.");

            var item = await _db.ComandaItens.SingleOrDefaultAsync(i => i.Id == itemId && i.ComandaId == comandaId, ct)
                ?? throw new ComandaInvalidaException("Item não encontrado.");
            if (item.Removido) { await tx.CommitAsync(ct); return; }

            // Devolve a quantidade total do item ao estoque.
            await _stock.DevolverEstoqueAsync(item.ProdutoId, item.Quantidade, usuarioId,
                TipoMovimentoEstoque.Devolucao, comandaId, itemId, "Item removido da comanda", ct);

            item.Removido = true;
            await _db.SaveChangesAsync(ct);

            comanda.ValorTotal = await RecalcularTotalAsync(comandaId, ct);
            comanda.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            await tx.CommitAsync(ct);

            await RegistrarAuditoriaAsync(usuarioId, "REMOVEU_ITEM", nameof(Comanda), comandaId,
                $"Item {itemId} removido da comanda {comanda.CodigoIdentificador}", ct);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }
    /// <summary>
    /// Cancela a comanda inteira, devolvendo todos os itens não removidos ao
    /// estoque. Usada quando a comanda é aberta por engano ou o cliente
    /// desiste antes de fechar/pagar.
    /// </summary>
    public async Task CancelarComandaAsync(Guid comandaId, Guid usuarioId, CancellationToken ct = default)
    {
        await using IDbContextTransaction tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            var comanda = await LockComandaAsync(comandaId, ct);
            if (comanda.Status is StatusComanda.Fechada)
                throw new ComandaInvalidaException("Comanda já fechada não pode ser cancelada por esta operação (ver estorno de venda).");

            var itens = await _db.ComandaItens.Where(i => i.ComandaId == comandaId && !i.Removido).ToListAsync(ct);
            foreach (var item in itens)
            {
                await _stock.DevolverEstoqueAsync(item.ProdutoId, item.Quantidade, usuarioId,
                    TipoMovimentoEstoque.Devolucao, comandaId, item.Id, "Comanda cancelada", ct);
                item.Removido = true;
            }

            comanda.Status = StatusComanda.Cancelada;
            comanda.ValorTotal = 0;
            comanda.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            await tx.CommitAsync(ct);

            await RegistrarAuditoriaAsync(usuarioId, "CANCELOU_COMANDA", nameof(Comanda), comandaId,
                $"Comanda {comanda.CodigoIdentificador} cancelada", ct);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }
    /// <summary>
    /// Adiciona um combo/kit à comanda (ex.: "Salgado + Refri" por um preço
    /// promocional). Em vez de existir um "produto combo" no estoque, cada
    /// produto componente vira uma linha NORMAL de ComandaItem — debitando
    /// o estoque de cada um separadamente, com o mesmo lock de concorrência
    /// de sempre — mas com o preço de cada linha recalculado
    /// proporcionalmente ao preço de venda normal de cada componente, de
    /// forma que a SOMA das linhas bata exatamente com o preço do combo.
    ///
    /// Exemplo: Salgado (normalmente R$8) + Refri (normalmente R$7) em
    /// combo por R$12 -> proporção 8:7, então o salgado fica com
    /// 12 * 8/15 = R$6,40 e o refri com 12 * 7/15 = R$5,60 (o último item
    /// absorve o arredondamento, pra soma bater exatamente com R$12,00).
    /// Isso mantém relatórios de "produto mais vendido"/"faturamento por
    /// categoria" corretos, sem precisar de nenhum tratamento especial
    /// neles — pra eles, são só ComandaItem/VendaItem normais.
    /// </summary>
    public async Task<Guid> AdicionarComboAsync(Guid comandaId, Guid comboId, int quantidadeCombos, Guid usuarioId, CancellationToken ct = default)
    {
        if (quantidadeCombos <= 0) throw new ArgumentException("Quantidade deve ser maior que zero.");

        await using IDbContextTransaction tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {

            var comanda = await LockComandaAsync(comandaId, ct);
            if (comanda.Status != StatusComanda.Aberta)
                throw new ComandaInvalidaException("Comanda não está aberta.");

            var combo = await _db.Combos.Include(c => c.Itens).ThenInclude(i => i.Produto)
                .SingleOrDefaultAsync(c => c.Id == comboId, ct)
                ?? throw new ComandaInvalidaException("Combo não encontrado.");
            if (!combo.Ativo) throw new ComandaInvalidaException("Combo inativo.");
            if (!combo.Itens.Any()) throw new ComandaInvalidaException("Combo não tem produtos configurados.");

            // Valor de referência (preço avulso normal de cada componente) usado
            // só para calcular a PROPORÇÃO da divisão — nunca é cobrado assim.
            var valorRetailTotal = combo.Itens.Sum(i => i.Produto!.PrecoVenda * i.Quantidade * quantidadeCombos);
            var valorComboTotal = combo.PrecoVenda * quantidadeCombos;

            var grupoComboId = Guid.NewGuid();
            decimal somaAlocada = 0;
            var itensCombo = combo.Itens.ToList();

            for (var i = 0; i < itensCombo.Count; i++)
            {
                var comboItem = itensCombo[i];
                var quantidadeProduto = comboItem.Quantidade * quantidadeCombos;
                var ehUltimoItem = i == itensCombo.Count - 1;

                // Baixa de estoque segura (mesmo lock pessimista de sempre) —
                // se faltar estoque de QUALQUER componente, a exceção interrompe
                // aqui e nada do combo é adicionado (nem os componentes já
                // baixados antes dele nesta chamada, pois o SaveChanges final
                // só acontece depois de todos passarem).
                var itemId = Guid.NewGuid();
                await _stock.BaixarEstoqueAsync(
                    comboItem.ProdutoId, quantidadeProduto, usuarioId, TipoMovimentoEstoque.SaidaVenda,
                    comandaId, itemId, $"Componente do combo '{combo.Nome}' na comanda {comanda.CodigoIdentificador}", ct);

                decimal subtotalItem;
                if (ehUltimoItem)
                {
                    // Último item absorve o resto (evita sobra/falta de centavos por arredondamento).
                    subtotalItem = valorComboTotal - somaAlocada;
                }
                else
                {
                    var proporcao = valorRetailTotal > 0
                        ? (comboItem.Produto!.PrecoVenda * quantidadeProduto) / valorRetailTotal
                        : 1m / itensCombo.Count;
                    subtotalItem = Math.Round(valorComboTotal * proporcao, 2);
                }
                somaAlocada += subtotalItem;

                var item = new ComandaItem
                {
                    Id = itemId,
                    ComandaId = comandaId,
                    ProdutoId = comboItem.ProdutoId,
                    Quantidade = quantidadeProduto,
                    PrecoUnitario = quantidadeProduto > 0 ? Math.Round(subtotalItem / quantidadeProduto, 4) : 0,
                    Subtotal = subtotalItem,
                    GrupoComboId = grupoComboId,
                    ComboNomeSnapshot = combo.Nome
                };
                _db.ComandaItens.Add(item);
            }
            await _db.SaveChangesAsync(ct);
            // Soma o valor exato do combo (não a soma arredondada das linhas)
            // no total da comanda, evitando qualquer drift de centavos.
            comanda.ValorTotal = await RecalcularTotalAsync(comandaId, ct);
            comanda.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            await tx.CommitAsync(ct);

            await RegistrarAuditoriaAsync(usuarioId, "ADICIONOU_COMBO", nameof(Comanda), comandaId,
                $"{quantidadeCombos}x combo '{combo.Nome}' adicionado na comanda {comanda.CodigoIdentificador}", ct);

            return grupoComboId;
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }
    /// <summary>Remove TODOS os itens de um combo de uma vez (identificados
    /// pelo GrupoComboId), devolvendo o estoque de cada componente.</summary>
    public async Task RemoverComboAsync(Guid comandaId, Guid grupoComboId, Guid usuarioId, CancellationToken ct = default)
    {
        await using IDbContextTransaction tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            var comanda = await LockComandaAsync(comandaId, ct);
            if (comanda.Status != StatusComanda.Aberta)
                throw new ComandaInvalidaException("Comanda não está aberta.");

            var itens = await _db.ComandaItens
                .Where(i => i.ComandaId == comandaId && i.GrupoComboId == grupoComboId && !i.Removido)
                .ToListAsync(ct);
            if (!itens.Any()) throw new ComandaInvalidaException("Combo não encontrado nesta comanda.");

            var nomeCombo = itens.First().ComboNomeSnapshot;
            foreach (var item in itens)
            {
                await _stock.DevolverEstoqueAsync(item.ProdutoId, item.Quantidade, usuarioId,
                    TipoMovimentoEstoque.Devolucao, comandaId, item.Id, "Combo removido da comanda", ct);
                item.Removido = true;
            }
            await _db.SaveChangesAsync(ct);

            comanda.ValorTotal = await RecalcularTotalAsync(comandaId, ct);
            comanda.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            await tx.CommitAsync(ct);

            await RegistrarAuditoriaAsync(usuarioId, "REMOVEU_COMBO", nameof(Comanda), comandaId,
                $"Combo '{nomeCombo}' removido da comanda {comanda.CodigoIdentificador}", ct);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }
    private async Task RegistrarAuditoriaAsync(Guid usuarioId, string acao, string entidade, Guid entidadeId, string dados, CancellationToken ct)
    {
        _db.AuditLogs.Add(new AuditLog
        {
            UsuarioId = usuarioId,
            Acao = acao,
            Entidade = entidade,
            EntidadeId = entidadeId,
            DadosJson = dados,
            DataHora = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(ct);
    }
}
