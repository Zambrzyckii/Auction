using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuctionServer.Modules.Warehouses.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Add_Warehouse_Participant_User_Index : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_WarehousesParticipants_UserId",
                table: "WarehousesParticipants",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WarehousesParticipants_UserId",
                table: "WarehousesParticipants");
        }
    }
}
