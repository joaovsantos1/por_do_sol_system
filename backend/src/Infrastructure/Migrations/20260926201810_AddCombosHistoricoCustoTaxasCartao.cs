using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCombosHistoricoCustoTaxasCartao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ValorLiquido",
                table: "Pagamentos",
                type: "numeric(12,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PrecoCustoRegistrado",
                table: "MovimentosEstoque",
                type: "numeric(12,2)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ComboNomeSnapshot",
                table: "ComandaItens",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "GrupoComboId",
                table: "ComandaItens",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Combos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Nome = table.Column<string>(type: "text", nullable: false),
                    Descricao = table.Column<string>(type: "text", nullable: true),
                    PrecoVenda = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    Ativo = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Combos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ConfiguracoesTaxas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TaxaCartaoCreditoPercentual = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    TaxaCartaoDebitoPercentual = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConfiguracoesTaxas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ComboItens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ComboId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProdutoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Quantidade = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ComboItens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ComboItens_Combos_ComboId",
                        column: x => x.ComboId,
                        principalTable: "Combos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ComboItens_Produtos_ProdutoId",
                        column: x => x.ProdutoId,
                        principalTable: "Produtos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ComandaItens_GrupoComboId",
                table: "ComandaItens",
                column: "GrupoComboId");

            migrationBuilder.CreateIndex(
                name: "IX_ComboItens_ComboId",
                table: "ComboItens",
                column: "ComboId");

            migrationBuilder.CreateIndex(
                name: "IX_ComboItens_ProdutoId",
                table: "ComboItens",
                column: "ProdutoId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ComboItens");

            migrationBuilder.DropTable(
                name: "ConfiguracoesTaxas");

            migrationBuilder.DropTable(
                name: "Combos");

            migrationBuilder.DropIndex(
                name: "IX_ComandaItens_GrupoComboId",
                table: "ComandaItens");

            migrationBuilder.DropColumn(
                name: "ValorLiquido",
                table: "Pagamentos");

            migrationBuilder.DropColumn(
                name: "PrecoCustoRegistrado",
                table: "MovimentosEstoque");

            migrationBuilder.DropColumn(
                name: "ComboNomeSnapshot",
                table: "ComandaItens");

            migrationBuilder.DropColumn(
                name: "GrupoComboId",
                table: "ComandaItens");
        }
    }
}
