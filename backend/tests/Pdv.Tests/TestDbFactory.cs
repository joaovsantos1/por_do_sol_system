using Microsoft.EntityFrameworkCore;
using Pdv.Domain.Entities;
using Pdv.Domain.Enums;
using Pdv.Infrastructure.Data;

namespace Pdv.Tests;

public static class TestDbFactory
{
    public static PdvDbContext CriarContexto()
    {
        var options = new DbContextOptionsBuilder<PdvDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new PdvDbContext(options);
    }

    public static (Usuario usuario, Produto produto) SeedBasico(PdvDbContext db, int estoqueInicial = 10)
    {
        var categoria = new Categoria { Nome = "Bebidas" };
        var usuario = new Usuario { Nome = "Operador Teste", Login = "teste", SenhaHash = "x", Perfil = PerfilUsuario.Operador };
        var produto = new Produto
        {
            Codigo = "P001", Nome = "Coca-Cola", CategoriaId = categoria.Id, Categoria = categoria,
            PrecoVenda = 6m, PrecoCusto = 3m, EstoqueAtual = estoqueInicial, EstoqueMinimo = 2, Unidade = "UN"
        };

        db.Categorias.Add(categoria);
        db.Usuarios.Add(usuario);
        db.Produtos.Add(produto);
        db.SaveChanges();

        return (usuario, produto);
    }
}
