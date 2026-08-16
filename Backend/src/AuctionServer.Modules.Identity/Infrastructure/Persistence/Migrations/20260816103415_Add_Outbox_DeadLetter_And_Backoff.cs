using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuctionServer.Modules.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Add_Outbox_DeadLetter_And_Backoff : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AttemptCount",
                table: "IdentityOutboxMessages",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<List<string>>(
                name: "Errors",
                table: "IdentityOutboxMessages",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'");

            migrationBuilder.AddColumn<bool>(
                name: "IsDead",
                table: "IdentityOutboxMessages",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "NextAttemptOn",
                table: "IdentityOutboxMessages",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AttemptCount",
                table: "IdentityOutboxMessages");

            migrationBuilder.DropColumn(
                name: "Errors",
                table: "IdentityOutboxMessages");

            migrationBuilder.DropColumn(
                name: "IsDead",
                table: "IdentityOutboxMessages");

            migrationBuilder.DropColumn(
                name: "NextAttemptOn",
                table: "IdentityOutboxMessages");
        }
    }
}
