using FluentAssertions;
using Pdv.Application.Comandas;
using Pdv.Infrastructure.Services;
using Pdv.Tests.Fakes;
using Xunit;

namespace Pdv.Tests;

public class ComandaServiceTests
{
    private static (ComandaService service, FakeStockService stock, Data.SeedResult seed) Criar(int estoqueInicial = 10)
    {
        var db = TestDbFactory.CriarContexto();
        var (usuario, produto) = TestDbFactory.SeedBasico(db, estoqueInicial);
        var stock = new FakeStockService();
        stock.Estoque[produto.Id] = estoqueInicial;
        var service = new ComandaService(db, stock);
        return (service, stock, new Data.SeedResult(usuario.Id, produto.Id));
    }

    [Fact]
    public async Task AdicionarItem_com_estoque_suficiente_deve_criar_item_e_baixar_estoque()
    {
        var (service, stock, seed) = Criar(estoqueInicial: 5);

        var comanda = await service.AbrirComandaAsync(seed.UsuarioId, null);
        var item = await service.AdicionarItemAsync(comanda.Id, seed.ProdutoId, 2, seed.UsuarioId);

        item.Quantidade.Should().Be(2);
        stock.Estoque[seed.ProdutoId].Should().Be(3);
    }

    [Fact]
    public async Task AdicionarItem_com_estoque_insuficiente_deve_lancar_excecao_e_nao_criar_item()
    {
        var (service, stock, seed) = Criar(estoqueInicial: 1);
        var comanda = await service.AbrirComandaAsync(seed.UsuarioId, null);

        var act = async () => await service.AdicionarItemAsync(comanda.Id, seed.ProdutoId, 2, seed.UsuarioId);

        await act.Should().ThrowAsync<EstoqueInsuficienteException>();
        stock.Estoque[seed.ProdutoId].Should().Be(1); // nada foi baixado
    }

    [Fact]
    public async Task AdicionarItem_em_comanda_fechada_deve_lancar_excecao()
    {
        var (service, _, seed) = Criar();
        var comanda = await service.AbrirComandaAsync(seed.UsuarioId, null);
        await service.CancelarComandaAsync(comanda.Id, seed.UsuarioId);

        var act = async () => await service.AdicionarItemAsync(comanda.Id, seed.ProdutoId, 1, seed.UsuarioId);

        await act.Should().ThrowAsync<ComandaInvalidaException>();
    }

    [Fact]
    public async Task AumentarQuantidade_deve_baixar_somente_a_diferenca()
    {
        var (service, stock, seed) = Criar(estoqueInicial: 10);
        var comanda = await service.AbrirComandaAsync(seed.UsuarioId, null);
        var item = await service.AdicionarItemAsync(comanda.Id, seed.ProdutoId, 2, seed.UsuarioId);

        await service.AlterarQuantidadeAsync(comanda.Id, item.Id, 5, seed.UsuarioId);

        // Baixou 2 (adicionar) + 3 (diferença de 2->5) = 5 no total; estoque 10-5=5
        stock.Estoque[seed.ProdutoId].Should().Be(5);
    }

    [Fact]
    public async Task DiminuirQuantidade_deve_devolver_somente_a_diferenca()
    {
        var (service, stock, seed) = Criar(estoqueInicial: 10);
        var comanda = await service.AbrirComandaAsync(seed.UsuarioId, null);
        var item = await service.AdicionarItemAsync(comanda.Id, seed.ProdutoId, 5, seed.UsuarioId);

        await service.AlterarQuantidadeAsync(comanda.Id, item.Id, 2, seed.UsuarioId);

        // Baixou 5, devolveu 3 (diferença 5->2) = estoque 10-5+3=8
        stock.Estoque[seed.ProdutoId].Should().Be(8);
    }

    [Fact]
    public async Task RemoverItem_deve_devolver_a_quantidade_total_ao_estoque()
    {
        var (service, stock, seed) = Criar(estoqueInicial: 10);
        var comanda = await service.AbrirComandaAsync(seed.UsuarioId, null);
        var item = await service.AdicionarItemAsync(comanda.Id, seed.ProdutoId, 4, seed.UsuarioId);

        await service.RemoverItemAsync(comanda.Id, item.Id, seed.UsuarioId);

        stock.Estoque[seed.ProdutoId].Should().Be(10);
    }

    [Fact]
    public async Task CancelarComanda_deve_devolver_todos_os_itens_nao_removidos()
    {
        var (service, stock, seed) = Criar(estoqueInicial: 10);
        var comanda = await service.AbrirComandaAsync(seed.UsuarioId, null);
        await service.AdicionarItemAsync(comanda.Id, seed.ProdutoId, 3, seed.UsuarioId);
        await service.AdicionarItemAsync(comanda.Id, seed.ProdutoId, 2, seed.UsuarioId);

        await service.CancelarComandaAsync(comanda.Id, seed.UsuarioId);

        stock.Estoque[seed.ProdutoId].Should().Be(10);
    }
}
