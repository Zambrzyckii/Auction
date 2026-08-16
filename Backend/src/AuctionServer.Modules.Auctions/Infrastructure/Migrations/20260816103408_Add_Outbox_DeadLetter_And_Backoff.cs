using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuctionServer.Modules.Auctions.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_Outbox_DeadLetter_And_Backoff : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AttemptCount",
                table: "OutboxMessages",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<List<string>>(
                name: "Errors",
                table: "OutboxMessages",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'");

            migrationBuilder.AddColumn<bool>(
                name: "IsDead",
                table: "OutboxMessages",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "NextAttemptOn",
                table: "OutboxMessages",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AttemptCount",
                table: "OutboxMessages");

            migrationBuilder.DropColumn(
                name: "Errors",
                table: "OutboxMessages");

            migrationBuilder.DropColumn(
                name: "IsDead",
                table: "OutboxMessages");

            migrationBuilder.DropColumn(
                name: "NextAttemptOn",
                table: "OutboxMessages");
        }
    }
}
