using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMesaNomeClienteComanda : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {

            migrationBuilder.AddColumn<string>(
                name: "NomeCliente",
                table: "Comandas",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "NumeroMesa",
                table: "Comandas",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Comandas_NumeroMesa",
                table: "Comandas",
                column: "NumeroMesa");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Comandas_NumeroMesa",
                table: "Comandas");

            migrationBuilder.DropColumn(
                name: "NomeCliente",
                table: "Comandas");

            migrationBuilder.DropColumn(
                name: "NumeroMesa",
                table: "Comandas");

        }
    }
}
