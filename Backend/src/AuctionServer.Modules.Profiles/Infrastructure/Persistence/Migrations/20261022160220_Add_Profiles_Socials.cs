using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuctionServer.Modules.Profiles.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Add_Profiles_Socials : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProfilesSocialLinks",
                columns: table => new
                {
                    Platform = table.Column<int>(type: "integer", nullable: false),
                    ProfileUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Url = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProfilesSocialLinks", x => new { x.ProfileUserId, x.Platform });
                    table.ForeignKey(
                        name: "FK_ProfilesSocialLinks_ProfilesUserProfiles_ProfileUserId",
                        column: x => x.ProfileUserId,
                        principalTable: "ProfilesUserProfiles",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProfilesSocialLinks");
        }
    }
}
