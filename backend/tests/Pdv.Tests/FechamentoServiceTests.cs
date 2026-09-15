using FluentAssertions;
using Pdv.Application.Comandas;
using Pdv.Domain.Enums;
using Pdv.Tests.Fakes;
using Xunit;

namespace Pdv.Tests;

public class FechamentoServiceTests
{
    private static (ComandaService comandaService, FechamentoService fechamentoService, Data.SeedResult seed, Infrastructure.Data.PdvDbContext db) Criar(int estoqueInicial = 10)
    {
        var db = TestDbFactory.CriarContexto();
        var (usuario, produto) = TestDbFactory.SeedBasico(db, estoqueInicial);
        var stock = new FakeStockService();
        stock.Estoque[produto.Id] = estoqueInicial;

        var comandaService = new ComandaService(db, stock);
        var fechamentoService = new FechamentoService(db);

        return (comandaService, fechamentoService, new Data.SeedResult(usuario.Id, produto.Id), db);
    }

    [Fact]
    public async Task Fechar_com_pagamento_unico_cobrindo_o_total_deve_gerar_venda()
    {
        var (comandaService, fechamentoService, seed, _) = Criar();
        var comanda = await comandaService.AbrirComandaAsync(seed.UsuarioId, null);
        await comandaService.AdicionarItemAsync(comanda.Id, seed.ProdutoId, 2, seed.UsuarioId); // 2x R$6 = R$12

        var venda = await fechamentoService.FecharComandaAsync(
            comanda.Id, new() { (FormaPagamento.Pix, 12m) }, seed.UsuarioId);

        venda.Total.Should().Be(12m);
        venda.Itens.Should().HaveCount(1);
    }

    [Fact]
    public async Task Fechar_com_pagamento_misto_cuja_soma_cobre_o_total_deve_funcionar()
    {
        var (comandaService, fechamentoService, seed, _) = Criar();
        var comanda = await comandaService.AbrirComandaAsync(seed.UsuarioId, null);
        await comandaService.AdicionarItemAsync(comanda.Id, seed.ProdutoId, 5, seed.UsuarioId); // R$30

        var venda = await fechamentoService.FecharComandaAsync(
            comanda.Id,
            new() { (FormaPagamento.Pix, 20m), (FormaPagamento.Dinheiro, 10m) },
            seed.UsuarioId);

        venda.Pagamentos.Should().HaveCount(2);
        venda.Pagamentos.Sum(p => p.Valor).Should().Be(30m);
    }

    [Fact]
    public async Task Fechar_com_soma_de_pagamentos_menor_que_o_total_deve_lancar_excecao()
    {
        var (comandaService, fechamentoService, seed, _) = Criar();
        var comanda = await comandaService.AbrirComandaAsync(seed.UsuarioId, null);
        await comandaService.AdicionarItemAsync(comanda.Id, seed.ProdutoId, 5, seed.UsuarioId); // R$30

        var act = async () => await fechamentoService.FecharComandaAsync(
            comanda.Id, new() { (FormaPagamento.Dinheiro, 20m) }, seed.UsuarioId);

        await act.Should().ThrowAsync<PagamentoInsuficienteException>();
    }

    [Fact]
    public async Task Fechar_comanda_sem_itens_deve_lancar_excecao()
    {
        var (comandaService, fechamentoService, seed, _) = Criar();
        var comanda = await comandaService.AbrirComandaAsync(seed.UsuarioId, null);

        var act = async () => await fechamentoService.FecharComandaAsync(
            comanda.Id, new() { (FormaPagamento.Pix, 100m) }, seed.UsuarioId);

        await act.Should().ThrowAsync<ComandaInvalidaException>();
    }
}
