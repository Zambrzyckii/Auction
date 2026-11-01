using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuctionServer.Modules.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Add_Outbox_Lease : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LeasedUntil",
                table: "IdentityOutboxMessages",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_IdentityOutboxMessages_Pending",
                table: "IdentityOutboxMessages",
                column: "CreatedOn",
                filter: "\"ProcessedOn\" IS NULL AND NOT \"IsDead\"");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_IdentityOutboxMessages_Pending",
                table: "IdentityOutboxMessages");

            migrationBuilder.DropColumn(
                name: "LeasedUntil",
                table: "IdentityOutboxMessages");
        }
    }
}
