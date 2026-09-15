using Pdv.Application.Auth;
using Pdv.Domain.Entities;
using Pdv.Domain.Enums;
using Pdv.Infrastructure.Data;

namespace Pdv.Api.Seed;

/// <summary>
/// Seed inicial: cria usuário administrador (senha vinda de variável de
/// ambiente/configuração, nunca hardcoded), algumas categorias e produtos de
/// EXEMPLO claramente marcados como tal na observação/código, para não
/// serem confundidos com dados reais da loja.
/// </summary>
public static class DatabaseSeeder
{
    public static async Task SeedAsync(PdvDbContext db, IConfiguration config)
    {
        if (!db.Usuarios.Any())
        {
            var adminLogin = config["Admin:Login"] ?? "admin";
            var adminSenha = config["Admin:Password"] ?? throw new InvalidOperationException(
                "Defina Admin:Password (variável de ambiente ADMIN_PASSWORD) para criar o usuário administrador inicial.");

            db.Usuarios.Add(new Usuario
            {
                Nome = "Administrador",
                Login = adminLogin,
                SenhaHash = AuthService.HashSenha(adminSenha),
                Perfil = PerfilUsuario.Administrador,
                Ativo = true
            });
        }

        if (!db.Categorias.Any())
        {
            var bebidas = new Categoria { Nome = "Bebidas" };
            var lanches = new Categoria { Nome = "Lanches" };
            var porcoes = new Categoria { Nome = "Porções" };
            db.Categorias.AddRange(bebidas, lanches, porcoes);
            await db.SaveChangesAsync();

            // Produtos de EXEMPLO (seed) — remover/editar antes de uso real na loja.
            db.Produtos.AddRange(
                new Produto
                {
                    Codigo = "EX-0001", Nome = "Coca-Cola 350ml [EXEMPLO]",
                    CategoriaId = bebidas.Id, PrecoVenda = 6.00m, PrecoCusto = 3.00m,
                    EstoqueAtual = 50, EstoqueMinimo = 10, Unidade = "UN"
                },
                new Produto
                {
                    Codigo = "EX-0002", Nome = "X-Burger [EXEMPLO]",
                    CategoriaId = lanches.Id, PrecoVenda = 25.00m, PrecoCusto = 12.00m,
                    EstoqueAtual = 30, EstoqueMinimo = 5, Unidade = "UN"
                },
                new Produto
                {
                    Codigo = "EX-0003", Nome = "Batata Frita [EXEMPLO]",
                    CategoriaId = porcoes.Id, PrecoVenda = 15.00m, PrecoCusto = 6.00m,
                    EstoqueAtual = 20, EstoqueMinimo = 5, Unidade = "UN"
                }
            );
        }

        await db.SaveChangesAsync();
    }
}
