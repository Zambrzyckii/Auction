using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AuctionServer.Modules.Pawnshop.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Add_Pawnshop_Stock : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "PendingStockPayoutRate",
                table: "PawnshopShops",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PendingStockRequestId",
                table: "PawnshopShops",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PendingStockRequestedOn",
                table: "PawnshopShops",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PawnshopStockItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PublicStockItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    PublicPawnshopId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Rarity = table.Column<int>(type: "integer", nullable: false),
                    Price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PayoutRate = table.Column<decimal>(type: "numeric(5,4)", precision: 5, scale: 4, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    SpawnedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SellAfter = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ResolvedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PayoutAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    Version = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PawnshopStockItems", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PawnshopStockItems_PublicStockItemId",
                table: "PawnshopStockItems",
                column: "PublicStockItemId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PawnshopStockItems_Status_SellAfter",
                table: "PawnshopStockItems",
                columns: new[] { "Status", "SellAfter" });

            migrationBuilder.CreateIndex(
                name: "IX_PawnshopStockItems_UserId_Status",
                table: "PawnshopStockItems",
                columns: new[] { "UserId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PawnshopStockItems");

            migrationBuilder.DropColumn(
                name: "PendingStockPayoutRate",
                table: "PawnshopShops");

            migrationBuilder.DropColumn(
                name: "PendingStockRequestId",
                table: "PawnshopShops");

            migrationBuilder.DropColumn(
                name: "PendingStockRequestedOn",
                table: "PawnshopShops");
        }
    }
}
