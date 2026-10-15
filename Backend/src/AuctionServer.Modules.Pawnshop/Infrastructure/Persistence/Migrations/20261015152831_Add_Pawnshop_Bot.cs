using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuctionServer.Modules.Pawnshop.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Add_Pawnshop_Bot : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "BotPayoutRate",
                table: "PawnshopShops",
                type: "numeric(5,4)",
                precision: 5,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "BotPurchasedOn",
                table: "PawnshopShops",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "BotRarity",
                table: "PawnshopShops",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<TimeSpan>(
                name: "BotSpawnInterval",
                table: "PawnshopShops",
                type: "interval",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BotTierName",
                table: "PawnshopShops",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "NextSpawnOn",
                table: "PawnshopShops",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PendingBotPayoutRate",
                table: "PawnshopShops",
                type: "numeric(5,4)",
                precision: 5,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PendingBotRarity",
                table: "PawnshopShops",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<TimeSpan>(
                name: "PendingBotSpawnInterval",
                table: "PawnshopShops",
                type: "interval",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PendingBotTierName",
                table: "PawnshopShops",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PawnshopShops_Status_NextSpawnOn",
                table: "PawnshopShops",
                columns: new[] { "Status", "NextSpawnOn" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PawnshopShops_Status_NextSpawnOn",
                table: "PawnshopShops");

            migrationBuilder.DropColumn(
                name: "BotPayoutRate",
                table: "PawnshopShops");

            migrationBuilder.DropColumn(
                name: "BotPurchasedOn",
                table: "PawnshopShops");

            migrationBuilder.DropColumn(
                name: "BotRarity",
                table: "PawnshopShops");

            migrationBuilder.DropColumn(
                name: "BotSpawnInterval",
                table: "PawnshopShops");

            migrationBuilder.DropColumn(
                name: "BotTierName",
                table: "PawnshopShops");

            migrationBuilder.DropColumn(
                name: "NextSpawnOn",
                table: "PawnshopShops");

            migrationBuilder.DropColumn(
                name: "PendingBotPayoutRate",
                table: "PawnshopShops");

            migrationBuilder.DropColumn(
                name: "PendingBotRarity",
                table: "PawnshopShops");

            migrationBuilder.DropColumn(
                name: "PendingBotSpawnInterval",
                table: "PawnshopShops");

            migrationBuilder.DropColumn(
                name: "PendingBotTierName",
                table: "PawnshopShops");
        }
    }
}
