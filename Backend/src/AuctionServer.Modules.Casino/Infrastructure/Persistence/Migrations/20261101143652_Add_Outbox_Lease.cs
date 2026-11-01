using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuctionServer.Modules.Casino.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Add_Outbox_Lease : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LeasedUntil",
                table: "CasinoOutboxMessages",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_CasinoOutboxMessages_Pending",
                table: "CasinoOutboxMessages",
                column: "CreatedOn",
                filter: "\"ProcessedOn\" IS NULL AND NOT \"IsDead\"");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_CasinoOutboxMessages_Pending",
                table: "CasinoOutboxMessages");

            migrationBuilder.DropColumn(
                name: "LeasedUntil",
                table: "CasinoOutboxMessages");
        }
    }
}
