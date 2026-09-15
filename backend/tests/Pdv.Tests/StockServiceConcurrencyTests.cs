using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pdv.Domain.Entities;
using Pdv.Domain.Enums;
using Pdv.Infrastructure.Data;
using Pdv.Infrastructure.Services;
using Testcontainers.PostgreSql;
using Xunit;

namespace Pdv.Tests;

/// <summary>
/// ESTE É O TESTE QUE VALIDA A REGRA CRÍTICA DO SISTEMA (item 3 do
/// documento de requisitos): dois usuários tentando consumir a mesma
/// unidade de estoque simultaneamente NUNCA podem ambos ter sucesso além
/// do que o estoque permite.
///
/// Precisa de Docker instalado na máquina/CI que rodar os testes, pois sobe
/// um PostgreSQL real via Testcontainers — o EF Core InMemory NÃO suporta
/// "SELECT ... FOR UPDATE" e não serviria para provar nada aqui.
/// Rodar com: dotnet test --filter FullyQualifiedName~Concorrencia
/// </summary>
public class StockServiceConcurrencyTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .Build();

    private PdvDbContext _db = default!;
    private Guid _produtoId;
    private Guid _usuarioId;

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();

        var options = new DbContextOptionsBuilder<PdvDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .Options;
        _db = new PdvDbContext(options);
        await _db.Database.EnsureCreatedAsync();

        var categoria = new Categoria { Nome = "Bebidas" };
        var usuario = new Usuario { Nome = "Teste", Login = "t1", SenhaHash = "x", Perfil = PerfilUsuario.Operador };
        // Estoque com exatamente 1 unidade — o cenário exato do documento de requisitos.
        var produto = new Produto
        {
            Codigo = "P001", Nome = "Coca-Cola", CategoriaId = categoria.Id, Categoria = categoria,
            PrecoVenda = 6m, PrecoCusto = 3m, EstoqueAtual = 1, EstoqueMinimo = 0, Unidade = "UN"
        };
        _db.AddRange(categoria, usuario, produto);
        await _db.SaveChangesAsync();

        _produtoId = produto.Id;
        _usuarioId = usuario.Id;
    }

    public async Task DisposeAsync()
    {
        await _postgres.DisposeAsync();
    }

    [Fact]
    public async Task Dois_usuarios_concorrentes_nunca_conseguem_vender_a_mesma_unica_unidade_duas_vezes()
    {
        // Duas "requisições" simultâneas, cada uma com seu próprio DbContext
        // (simulando duas requisições HTTP paralelas de usuários diferentes),
        // tentando baixar 1 unidade do MESMO produto que só tem 1 em estoque.
        var options = new DbContextOptionsBuilder<PdvDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .Options;

        async Task<bool> TentarBaixar()
        {
            await using var db = new PdvDbContext(options);
            var stock = new StockService(db);
            try
            {
                await stock.BaixarEstoqueAsync(_produtoId, 1, _usuarioId, TipoMovimentoEstoque.SaidaVenda, null, null, "teste concorrência");
                return true;
            }
            catch (EstoqueInsuficienteException)
            {
                return false;
            }
        }

        var tarefaA = TentarBaixar();
        var tarefaB = TentarBaixar();
        var resultados = await Task.WhenAll(tarefaA, tarefaB);

        // Exatamente UMA das duas deve ter sucesso — nunca as duas, nunca nenhuma.
        resultados.Count(sucesso => sucesso).Should().Be(1);

        // Estoque final nunca pode ficar negativo.
        await using var verificacao = new PdvDbContext(options);
        var estoqueFinal = await verificacao.Produtos.AsNoTracking()
            .Where(p => p.Id == _produtoId).Select(p => p.EstoqueAtual).SingleAsync();
        estoqueFinal.Should().Be(0);
    }
}
