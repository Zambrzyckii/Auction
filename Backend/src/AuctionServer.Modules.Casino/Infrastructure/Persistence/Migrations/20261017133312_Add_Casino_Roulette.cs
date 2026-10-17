using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AuctionServer.Modules.Casino.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Add_Casino_Roulette : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CasinoRouletteSpins",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PublicSpinId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Pocket = table.Column<short>(type: "smallint", nullable: false),
                    TotalStake = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalPayout = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PlacedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CasinoRouletteSpins", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CasinoRouletteBets",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Selection = table.Column<short>(type: "smallint", nullable: true),
                    Stake = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Payout = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    SpinId = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CasinoRouletteBets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CasinoRouletteBets_CasinoRouletteSpins_SpinId",
                        column: x => x.SpinId,
                        principalTable: "CasinoRouletteSpins",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CasinoRouletteBets_SpinId",
                table: "CasinoRouletteBets",
                column: "SpinId");

            migrationBuilder.CreateIndex(
                name: "IX_CasinoRouletteSpins_PublicSpinId",
                table: "CasinoRouletteSpins",
                column: "PublicSpinId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CasinoRouletteSpins_UserId_PlacedOn",
                table: "CasinoRouletteSpins",
                columns: new[] { "UserId", "PlacedOn" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CasinoRouletteBets");

            migrationBuilder.DropTable(
                name: "CasinoRouletteSpins");
        }
    }
}
