using Microsoft.EntityFrameworkCore;
using Pdv.Domain.Entities;

namespace Pdv.Infrastructure.Data;

public class PdvDbContext : DbContext
{
    public PdvDbContext(DbContextOptions<PdvDbContext> options) : base(options) { }

    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Categoria> Categorias => Set<Categoria>();
    public DbSet<Produto> Produtos => Set<Produto>();
    public DbSet<MovimentoEstoque> MovimentosEstoque => Set<MovimentoEstoque>();
    public DbSet<Comanda> Comandas => Set<Comanda>();
    public DbSet<ComandaItem> ComandaItens => Set<ComandaItem>();
    public DbSet<Venda> Vendas => Set<Venda>();
    public DbSet<VendaItem> VendaItens => Set<VendaItem>();
    public DbSet<Pagamento> Pagamentos => Set<Pagamento>();
    public DbSet<Meta> Metas => Set<Meta>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Usuario>(e =>
        {
            e.HasIndex(u => u.Login).IsUnique();
            e.Property(u => u.Nome).HasMaxLength(150).IsRequired();
            e.Property(u => u.Login).HasMaxLength(100).IsRequired();
        });

        modelBuilder.Entity<Categoria>(e =>
        {
            e.HasIndex(c => c.Nome).IsUnique();
        });

        modelBuilder.Entity<Produto>(e =>
        {
            e.HasIndex(p => p.Codigo).IsUnique();
            e.HasIndex(p => p.CodigoBarras);
            e.Property(p => p.PrecoVenda).HasColumnType("numeric(12,2)");
            e.Property(p => p.PrecoCusto).HasColumnType("numeric(12,2)");
            e.HasOne(p => p.Categoria).WithMany(c => c.Produtos)
                .HasForeignKey(p => p.CategoriaId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<MovimentoEstoque>(e =>
        {
            e.HasIndex(m => new { m.ProdutoId, m.CreatedAt });
            e.HasOne(m => m.Produto).WithMany().HasForeignKey(m => m.ProdutoId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(m => m.Usuario).WithMany().HasForeignKey(m => m.UsuarioId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Comanda>(e =>
        {
            e.HasIndex(c => c.Numero).IsUnique();
            e.HasIndex(c => c.CodigoIdentificador).IsUnique();
            e.HasIndex(c => c.NumeroMesa);
            e.Property(c => c.NomeCliente).HasMaxLength(120);
            e.Property(c => c.ValorTotal).HasColumnType("numeric(12,2)");
            e.HasOne(c => c.AbertaPorUsuario).WithMany()
                .HasForeignKey(c => c.AbertaPorUsuarioId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(c => c.FechadaPorUsuario).WithMany()
                .HasForeignKey(c => c.FechadaPorUsuarioId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ComandaItem>(e =>
        {
            e.Property(i => i.PrecoUnitario).HasColumnType("numeric(12,2)");
            e.Property(i => i.Subtotal).HasColumnType("numeric(12,2)");
            e.HasOne(i => i.Comanda).WithMany(c => c.Itens)
                .HasForeignKey(i => i.ComandaId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(i => i.Produto).WithMany()
                .HasForeignKey(i => i.ProdutoId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Venda>(e =>
        {
            e.Property(v => v.Total).HasColumnType("numeric(12,2)");
            e.Property(v => v.Desconto).HasColumnType("numeric(12,2)");
            e.HasOne(v => v.Comanda).WithMany()
                .HasForeignKey(v => v.ComandaId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<VendaItem>(e =>
        {
            e.Property(i => i.PrecoUnitario).HasColumnType("numeric(12,2)");
            e.Property(i => i.Subtotal).HasColumnType("numeric(12,2)");
            e.HasOne(i => i.Venda).WithMany(v => v.Itens)
                .HasForeignKey(i => i.VendaId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Pagamento>(e =>
        {
            e.Property(p => p.Valor).HasColumnType("numeric(12,2)");
            e.HasOne(p => p.Comanda).WithMany(c => c.Pagamentos)
                .HasForeignKey(p => p.ComandaId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Meta>(e =>
        {
            e.Property(m => m.ValorAlvo).HasColumnType("numeric(12,2)");
        });
    }
}
