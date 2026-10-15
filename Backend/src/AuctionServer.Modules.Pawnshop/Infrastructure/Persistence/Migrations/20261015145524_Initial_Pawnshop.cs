using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AuctionServer.Modules.Pawnshop.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Initial_Pawnshop : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PawnshopOutboxMessages",
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
                    table.PrimaryKey("PK_PawnshopOutboxMessages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PawnshopProcessedMessages",
                columns: table => new
                {
                    EventId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProcessedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PawnshopProcessedMessages", x => x.EventId);
                });

            migrationBuilder.CreateTable(
                name: "PawnshopShops",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PublicPawnshopId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    RequestedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ActivatedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectionReason = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    PendingPaymentId = table.Column<Guid>(type: "uuid", nullable: true),
                    PendingPaymentRequestedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Version = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PawnshopShops", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PawnshopShops_PublicPawnshopId",
                table: "PawnshopShops",
                column: "PublicPawnshopId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PawnshopShops_UserId",
                table: "PawnshopShops",
                column: "UserId",
                unique: true,
                filter: "\"Status\" IN (0, 1)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PawnshopOutboxMessages");

            migrationBuilder.DropTable(
                name: "PawnshopProcessedMessages");

            migrationBuilder.DropTable(
                name: "PawnshopShops");
        }
    }
}
