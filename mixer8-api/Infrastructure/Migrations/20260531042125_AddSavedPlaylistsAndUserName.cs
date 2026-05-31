using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mixer8.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSavedPlaylistsAndUserName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Name",
                table: "UserProfiles",
                newName: "LastName");

            migrationBuilder.AddColumn<string>(
                name: "FirstName",
                table: "UserProfiles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UserName",
                table: "UserProfiles",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql("UPDATE \"UserProfiles\" SET \"UserName\" = SPLIT_PART((SELECT \"Email\" FROM \"Users\" WHERE \"Users\".\"UserId\" = \"UserProfiles\".\"UserId\"), '@', 1);");

            migrationBuilder.CreateTable(
                name: "SavedPlaylists",
                columns: table => new
                {
                    SavedPlaylistId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlaylistId = table.Column<Guid>(type: "uuid", nullable: false),
                    SavedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SavedPlaylists", x => x.SavedPlaylistId);
                    table.ForeignKey(
                        name: "FK_SavedPlaylists_Playlists_PlaylistId",
                        column: x => x.PlaylistId,
                        principalTable: "Playlists",
                        principalColumn: "PlaylistId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SavedPlaylists_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserProfiles_UserName",
                table: "UserProfiles",
                column: "UserName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SavedPlaylists_PlaylistId",
                table: "SavedPlaylists",
                column: "PlaylistId");

            migrationBuilder.CreateIndex(
                name: "IX_SavedPlaylists_UserId",
                table: "SavedPlaylists",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SavedPlaylists");

            migrationBuilder.DropIndex(
                name: "IX_UserProfiles_UserName",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "FirstName",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "UserName",
                table: "UserProfiles");

            migrationBuilder.RenameColumn(
                name: "LastName",
                table: "UserProfiles",
                newName: "Name");
        }
    }
}
