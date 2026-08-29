using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuctionServer.Modules.Auctions.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_Auction_Status_And_Item_Snapshot : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "Auctions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql("UPDATE \"Auctions\" SET \"Status\" = CASE WHEN \"IsClosed\" THEN 2 ELSE 1 END;");

            migrationBuilder.DropIndex(
                name: "IX_Auctions_ItemId",
                table: "Auctions");

            migrationBuilder.DropColumn(
                name: "IsClosed",
                table: "Auctions");

            migrationBuilder.AddColumn<string>(
                name: "CancellationReason",
                table: "Auctions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ItemName",
                table: "Auctions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ItemOfficialPrice",
                table: "Auctions",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ItemRarity",
                table: "Auctions",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Auctions_ItemId",
                table: "Auctions",
                column: "ItemId",
                unique: true,
                filter: "\"Status\" IN (0, 1)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Auctions_ItemId",
                table: "Auctions");

            migrationBuilder.AddColumn<bool>(
                name: "IsClosed",
                table: "Auctions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql("UPDATE \"Auctions\" SET \"IsClosed\" = (\"Status\" IN (2, 3));");

            migrationBuilder.DropColumn(
                name: "CancellationReason",
                table: "Auctions");

            migrationBuilder.DropColumn(
                name: "ItemName",
                table: "Auctions");

            migrationBuilder.DropColumn(
                name: "ItemOfficialPrice",
                table: "Auctions");

            migrationBuilder.DropColumn(
                name: "ItemRarity",
                table: "Auctions");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Auctions");

            migrationBuilder.CreateIndex(
                name: "IX_Auctions_ItemId",
                table: "Auctions",
                column: "ItemId",
                unique: true,
                filter: "\"IsClosed\" = false");
        }
    }
}
