using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuctionServer.Modules.Auctions.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Align_Auctions_With_Configuration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Auctions_AuctionId",
                table: "Auctions");

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedOn",
                table: "OutboxMessages",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AlterColumn<decimal>(
                name: "CurrentPrice",
                table: "Auctions",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric");

            migrationBuilder.CreateIndex(
                name: "IX_Auctions_PublicAuctionId",
                table: "Auctions",
                column: "PublicAuctionId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Auctions_PublicAuctionId",
                table: "Auctions");

            migrationBuilder.DropColumn(
                name: "CreatedOn",
                table: "OutboxMessages");

            migrationBuilder.AlterColumn<decimal>(
                name: "CurrentPrice",
                table: "Auctions",
                type: "numeric",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)",
                oldPrecision: 18,
                oldScale: 2);

            migrationBuilder.CreateIndex(
                name: "IX_Auctions_AuctionId",
                table: "Auctions",
                column: "AuctionId",
                unique: true,
                filter: "\"IsClosed\" = false");
        }
    }
}
