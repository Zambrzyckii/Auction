using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuctionServer.Modules.Wallets.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Add_Outbox_Lease : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LeasedUntil",
                table: "WalletsOutboxMessages",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_WalletsOutboxMessages_Pending",
                table: "WalletsOutboxMessages",
                column: "CreatedOn",
                filter: "\"ProcessedOn\" IS NULL AND NOT \"IsDead\"");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WalletsOutboxMessages_Pending",
                table: "WalletsOutboxMessages");

            migrationBuilder.DropColumn(
                name: "LeasedUntil",
                table: "WalletsOutboxMessages");
        }
    }
}
