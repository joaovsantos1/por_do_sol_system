namespace Pdv.Application.Comandas;

public record AdicionarItemRequest(Guid ProdutoId, int Quantidade);

public record AlterarQuantidadeRequest(int NovaQuantidade);

public record ComandaItemResponse(
    Guid Id, Guid ProdutoId, string ProdutoNome, int Quantidade,
    decimal PrecoUnitario, decimal Subtotal, bool Removido);

public record ComandaResponse(
    Guid Id, int Numero, string CodigoIdentificador, string Status,
    DateTime AbertaEm, string AbertaPorNome, decimal ValorTotal,
    string? Observacoes, List<ComandaItemResponse> Itens);

public record AbrirComandaRequest(string? Observacoes);

public record FecharComandaRequest(List<PagamentoRequest> Pagamentos);

public record PagamentoRequest(string Forma, decimal Valor);
