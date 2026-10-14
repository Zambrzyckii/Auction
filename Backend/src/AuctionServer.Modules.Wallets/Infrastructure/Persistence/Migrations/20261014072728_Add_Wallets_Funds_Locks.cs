using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AuctionServer.Modules.Wallets.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Add_Wallets_Funds_Locks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WalletsFundsLocks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PublicAuctionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    WalletUserId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WalletsFundsLocks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WalletsFundsLocks_Wallets_WalletUserId",
                        column: x => x.WalletUserId,
                        principalTable: "Wallets",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WalletsFundsLocks_WalletUserId_PublicAuctionId",
                table: "WalletsFundsLocks",
                columns: new[] { "WalletUserId", "PublicAuctionId" },
                unique: true,
                filter: "\"Status\" = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WalletsFundsLocks");
        }
    }
}
