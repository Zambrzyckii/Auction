using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AuctionServer.Modules.Casino.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Initial_Casino : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CasinoAccounts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Balance = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    LifetimeBought = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    LifetimeCashedOut = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Version = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CasinoAccounts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CasinoChipPurchases",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PublicPurchaseId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    RequestedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ResolvedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectionReason = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Version = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CasinoChipPurchases", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CasinoOutboxMessages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "text", nullable: false),
                    Content = table.Column<string>(type: "text", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ProcessedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AttemptCount = table.Column<int>(type: "integer", nullable: false),
                    Errors = table.Column<List<string>>(type: "text[]", nullable: false),
                    IsDead = table.Column<bool>(type: "boolean", nullable: false),
                    NextAttemptOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CasinoOutboxMessages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CasinoProcessedMessages",
                columns: table => new
                {
                    EventId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProcessedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CasinoProcessedMessages", x => x.EventId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CasinoAccounts_UserId",
                table: "CasinoAccounts",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CasinoChipPurchases_PublicPurchaseId",
                table: "CasinoChipPurchases",
                column: "PublicPurchaseId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CasinoChipPurchases_Status_RequestedOn",
                table: "CasinoChipPurchases",
                columns: new[] { "Status", "RequestedOn" });

            migrationBuilder.CreateIndex(
                name: "IX_CasinoChipPurchases_UserId",
                table: "CasinoChipPurchases",
                column: "UserId",
                unique: true,
                filter: "\"Status\" = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CasinoAccounts");

            migrationBuilder.DropTable(
                name: "CasinoChipPurchases");

            migrationBuilder.DropTable(
                name: "CasinoOutboxMessages");

            migrationBuilder.DropTable(
                name: "CasinoProcessedMessages");
        }
    }
}
