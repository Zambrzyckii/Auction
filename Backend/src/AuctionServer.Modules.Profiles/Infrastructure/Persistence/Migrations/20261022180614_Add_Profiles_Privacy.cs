using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuctionServer.Modules.Profiles.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Add_Profiles_Privacy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsPrivate",
                table: "ProfilesUserProfiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsPrivate",
                table: "ProfilesUserProfiles");
        }
    }
}
