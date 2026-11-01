using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuctionServer.Shared.Infrastructure.Delivery.Migrations
{
    /// <inheritdoc />
    public partial class Add_Delivery_Messages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DeliveryMessages",
                columns: table => new
                {
                    MessageId = table.Column<Guid>(type: "uuid", nullable: false),
                    Recipient = table.Column<string>(type: "text", nullable: false),
                    Position = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<string>(type: "text", nullable: false),
                    Content = table.Column<string>(type: "text", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ProcessedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AttemptCount = table.Column<int>(type: "integer", nullable: false),
                    Errors = table.Column<List<string>>(type: "text[]", nullable: false),
                    IsDead = table.Column<bool>(type: "boolean", nullable: false),
                    NextAttemptOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LeasedUntil = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DeliveryMessages", x => new { x.MessageId, x.Recipient });
                });

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryMessages_Pending",
                table: "DeliveryMessages",
                columns: new[] { "CreatedOn", "Position" },
                filter: "\"ProcessedOn\" IS NULL AND NOT \"IsDead\"");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DeliveryMessages");
        }
    }
}
