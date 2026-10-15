using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuctionServer.Modules.Pawnshop.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Set_Pawnshop_Stock_Rate_Precision : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "PendingStockPayoutRate",
                table: "PawnshopShops",
                type: "numeric(5,4)",
                precision: 5,
                scale: 4,
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric",
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "PendingStockPayoutRate",
                table: "PawnshopShops",
                type: "numeric",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(5,4)",
                oldPrecision: 5,
                oldScale: 4,
                oldNullable: true);
        }
    }
}
