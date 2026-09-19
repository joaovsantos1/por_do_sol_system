using Microsoft.EntityFrameworkCore;
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

        var comanda = await _db.Comandas.SingleOrDefaultAsync(c => c.Id == comandaId, ct)
            ?? throw new ComandaInvalidaException("Comanda não encontrada.");

        if (comanda.Status != StatusComanda.Aberta)
            throw new ComandaInvalidaException("Comanda não está aberta.");

        var produto = await _db.Produtos.AsNoTracking().SingleOrDefaultAsync(p => p.Id == produtoId, ct)
            ?? throw new ComandaInvalidaException("Produto não encontrado.");

        if (!produto.Ativo)
            throw new ComandaInvalidaException("Produto inativo.");

        // Baixa de estoque segura contra concorrência (lock pessimista dentro
        // do StockService). Se não houver quantidade suficiente, lança
        // EstoqueInsuficienteException e nada abaixo é executado.
        var itemId = Guid.NewGuid();
        await _stock.BaixarEstoqueAsync(
            produtoId, quantidade, usuarioId, TipoMovimentoEstoque.SaidaVenda,
            comandaId, itemId, $"Item adicionado na comanda {comanda.CodigoIdentificador}", ct);

        var item = new ComandaItem
        {
            Id = itemId,
            ComandaId = comandaId,
            ProdutoId = produtoId,
            Quantidade = quantidade,
            PrecoUnitario = produto.PrecoVenda,
            Subtotal = produto.PrecoVenda * quantidade
        };
        _db.ComandaItens.Add(item);

        comanda.ValorTotal += item.Subtotal;
        comanda.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        await RegistrarAuditoriaAsync(usuarioId, "ADICIONOU_ITEM", nameof(Comanda), comandaId,
            $"{quantidade}x {produto.Nome} adicionado(s) na comanda {comanda.CodigoIdentificador}", ct);

        return item;
    }

    public async Task AlterarQuantidadeAsync(Guid comandaId, Guid itemId, int novaQuantidade, Guid usuarioId, CancellationToken ct = default)
    {
        if (novaQuantidade <= 0) throw new ArgumentException("Use remover item em vez de quantidade zero.");

        var comanda = await _db.Comandas.SingleOrDefaultAsync(c => c.Id == comandaId, ct)
            ?? throw new ComandaInvalidaException("Comanda não encontrada.");
        if (comanda.Status != StatusComanda.Aberta)
            throw new ComandaInvalidaException("Comanda não está aberta.");

        var item = await _db.ComandaItens.SingleOrDefaultAsync(i => i.Id == itemId && i.ComandaId == comandaId, ct)
            ?? throw new ComandaInvalidaException("Item não encontrado.");
        if (item.Removido) throw new ComandaInvalidaException("Item já foi removido.");

        var quantidadeAntiga = item.Quantidade;

        // Ajusta estoque apenas pela diferença (aumenta baixa ou devolve a diferença).
        await _stock.AjustarQuantidadeAsync(item.ProdutoId, quantidadeAntiga, novaQuantidade, usuarioId, comandaId, itemId, ct);

        comanda.ValorTotal -= item.Subtotal;
        item.Quantidade = novaQuantidade;
        item.Subtotal = item.PrecoUnitario * novaQuantidade;
        comanda.ValorTotal += item.Subtotal;
        comanda.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        await RegistrarAuditoriaAsync(usuarioId, "ALTEROU_QUANTIDADE", nameof(Comanda), comandaId,
            $"Item {itemId} alterado de {quantidadeAntiga} para {novaQuantidade}", ct);
    }

    public async Task RemoverItemAsync(Guid comandaId, Guid itemId, Guid usuarioId, CancellationToken ct = default)
    {
        var comanda = await _db.Comandas.SingleOrDefaultAsync(c => c.Id == comandaId, ct)
            ?? throw new ComandaInvalidaException("Comanda não encontrada.");
        if (comanda.Status != StatusComanda.Aberta)
            throw new ComandaInvalidaException("Comanda não está aberta.");

        var item = await _db.ComandaItens.SingleOrDefaultAsync(i => i.Id == itemId && i.ComandaId == comandaId, ct)
            ?? throw new ComandaInvalidaException("Item não encontrado.");
        if (item.Removido) return;

        // Devolve a quantidade total do item ao estoque.
        await _stock.DevolverEstoqueAsync(item.ProdutoId, item.Quantidade, usuarioId,
            TipoMovimentoEstoque.Devolucao, comandaId, itemId, "Item removido da comanda", ct);

        item.Removido = true;
        comanda.ValorTotal -= item.Subtotal;
        comanda.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        await RegistrarAuditoriaAsync(usuarioId, "REMOVEU_ITEM", nameof(Comanda), comandaId,
            $"Item {itemId} removido da comanda {comanda.CodigoIdentificador}", ct);
    }

    /// <summary>
    /// Cancela a comanda inteira, devolvendo todos os itens não removidos ao
    /// estoque. Usada quando a comanda é aberta por engano ou o cliente
    /// desiste antes de fechar/pagar.
    /// </summary>
    public async Task CancelarComandaAsync(Guid comandaId, Guid usuarioId, CancellationToken ct = default)
    {
        var comanda = await _db.Comandas.Include(c => c.Itens)
            .SingleOrDefaultAsync(c => c.Id == comandaId, ct)
            ?? throw new ComandaInvalidaException("Comanda não encontrada.");

        if (comanda.Status is StatusComanda.Fechada)
            throw new ComandaInvalidaException("Comanda já fechada não pode ser cancelada por esta operação (ver estorno de venda).");

        foreach (var item in comanda.Itens.Where(i => !i.Removido))
        {
            await _stock.DevolverEstoqueAsync(item.ProdutoId, item.Quantidade, usuarioId,
                TipoMovimentoEstoque.Devolucao, comandaId, item.Id, "Comanda cancelada", ct);
            item.Removido = true;
        }

        comanda.Status = StatusComanda.Cancelada;
        comanda.ValorTotal = 0;
        comanda.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        await RegistrarAuditoriaAsync(usuarioId, "CANCELOU_COMANDA", nameof(Comanda), comandaId,
            $"Comanda {comanda.CodigoIdentificador} cancelada", ct);
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
