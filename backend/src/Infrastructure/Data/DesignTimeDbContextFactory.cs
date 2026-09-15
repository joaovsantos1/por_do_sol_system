using DotNetEnv;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace Pdv.Infrastructure.Data;

/// <summary>
/// Usado pela ferramenta `dotnet ef` (design-time) para criar migrations
/// sem precisar subir toda a aplicação Web. Lê a connection string de
/// variável de ambiente (mesma usada em runtime) ou usa um fallback local
/// apenas para desenvolvimento.
/// </summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<PdvDbContext>
{
    public PdvDbContext CreateDbContext(string[] args)
    {
        Env.Load();
        var config = new ConfigurationBuilder()
            .AddEnvironmentVariables()
            .Build();

        var connectionString = config["ConnectionStrings__Default"]
            ?? throw new InvalidOperationException(
                "ConnectionStrings__Default não foi configurada."
            );

        var optionsBuilder = new DbContextOptionsBuilder<PdvDbContext>();
        optionsBuilder.UseNpgsql(connectionString);

        return new PdvDbContext(optionsBuilder.Options);
    }
}
