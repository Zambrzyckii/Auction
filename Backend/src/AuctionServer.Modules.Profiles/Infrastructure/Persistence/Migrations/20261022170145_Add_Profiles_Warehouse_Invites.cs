using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuctionServer.Modules.Profiles.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Add_Profiles_Warehouse_Invites : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProfilesWarehouseInvites",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    InviterId = table.Column<Guid>(type: "uuid", nullable: false),
                    InviteeId = table.Column<Guid>(type: "uuid", nullable: false),
                    PublicWarehouseId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProfilesWarehouseInvites", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProfilesWarehouseInvites_InviteeId",
                table: "ProfilesWarehouseInvites",
                column: "InviteeId");

            migrationBuilder.CreateIndex(
                name: "IX_ProfilesWarehouseInvites_InviterId_InviteeId_PublicWarehous~",
                table: "ProfilesWarehouseInvites",
                columns: new[] { "InviterId", "InviteeId", "PublicWarehouseId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProfilesWarehouseInvites");
        }
    }
}
