using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuctionServer.Modules.Auctions.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_Auction_Seller_Index : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Auctions_SellerUserId",
                table: "Auctions",
                column: "SellerUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Auctions_SellerUserId",
                table: "Auctions");
        }
    }
}
