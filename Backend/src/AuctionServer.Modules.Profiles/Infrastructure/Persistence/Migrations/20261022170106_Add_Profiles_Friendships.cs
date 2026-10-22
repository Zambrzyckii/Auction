using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuctionServer.Modules.Profiles.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Add_Profiles_Friendships : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProfilesFriendships",
                columns: table => new
                {
                    PublicFriendshipId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequesterId = table.Column<Guid>(type: "uuid", nullable: false),
                    AddresseeId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserLowId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserHighId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProfilesFriendships", x => x.PublicFriendshipId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProfilesFriendships_AddresseeId",
                table: "ProfilesFriendships",
                column: "AddresseeId");

            migrationBuilder.CreateIndex(
                name: "IX_ProfilesFriendships_RequesterId",
                table: "ProfilesFriendships",
                column: "RequesterId");

            migrationBuilder.CreateIndex(
                name: "IX_ProfilesFriendships_UserLowId_UserHighId",
                table: "ProfilesFriendships",
                columns: new[] { "UserLowId", "UserHighId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProfilesFriendships");
        }
    }
}
