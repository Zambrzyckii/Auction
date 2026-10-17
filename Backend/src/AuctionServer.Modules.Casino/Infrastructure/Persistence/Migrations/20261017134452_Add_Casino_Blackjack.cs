using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AuctionServer.Modules.Casino.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Add_Casino_Blackjack : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CasinoBlackjackHands",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PublicHandId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Stake = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Doubled = table.Column<bool>(type: "boolean", nullable: false),
                    PlayerCards = table.Column<List<int>>(type: "integer[]", nullable: false),
                    DealerCards = table.Column<List<int>>(type: "integer[]", nullable: false),
                    Outcome = table.Column<int>(type: "integer", nullable: true),
                    Payout = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    AutoStood = table.Column<bool>(type: "boolean", nullable: false),
                    StartedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastActionOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Version = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CasinoBlackjackHands", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CasinoBlackjackHands_PublicHandId",
                table: "CasinoBlackjackHands",
                column: "PublicHandId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CasinoBlackjackHands_Status_LastActionOn",
                table: "CasinoBlackjackHands",
                columns: new[] { "Status", "LastActionOn" });

            migrationBuilder.CreateIndex(
                name: "IX_CasinoBlackjackHands_UserId",
                table: "CasinoBlackjackHands",
                column: "UserId",
                unique: true,
                filter: "\"Status\" = 0");

            migrationBuilder.CreateIndex(
                name: "IX_CasinoBlackjackHands_UserId_StartedOn",
                table: "CasinoBlackjackHands",
                columns: new[] { "UserId", "StartedOn" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CasinoBlackjackHands");
        }
    }
}
