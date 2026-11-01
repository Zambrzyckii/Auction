using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuctionServer.Modules.Warehouses.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Add_Outbox_Lease : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LeasedUntil",
                table: "WarehousesOutboxMessages",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_WarehousesOutboxMessages_Pending",
                table: "WarehousesOutboxMessages",
                column: "CreatedOn",
                filter: "\"ProcessedOn\" IS NULL AND NOT \"IsDead\"");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WarehousesOutboxMessages_Pending",
                table: "WarehousesOutboxMessages");

            migrationBuilder.DropColumn(
                name: "LeasedUntil",
                table: "WarehousesOutboxMessages");
        }
    }
}
