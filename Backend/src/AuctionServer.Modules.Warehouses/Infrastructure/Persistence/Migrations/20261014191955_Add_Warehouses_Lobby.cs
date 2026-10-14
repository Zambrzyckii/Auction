using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AuctionServer.Modules.Warehouses.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Add_Warehouses_Lobby : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CancellationReason",
                table: "WarehousesWars",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "WarehousesParticipants",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    State = table.Column<int>(type: "integer", nullable: false),
                    WarehouseWarId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WarehousesParticipants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WarehousesParticipants_WarehousesWars_WarehouseWarId",
                        column: x => x.WarehouseWarId,
                        principalTable: "WarehousesWars",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WarehousesParticipants_WarehouseWarId_UserId",
                table: "WarehousesParticipants",
                columns: new[] { "WarehouseWarId", "UserId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WarehousesParticipants");

            migrationBuilder.DropColumn(
                name: "CancellationReason",
                table: "WarehousesWars");
        }
    }
}
