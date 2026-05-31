using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mixer8.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAlbumInfrastructure : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "AlbumId",
                table: "Tracks",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DiscNumber",
                table: "Tracks",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TrackNumber",
                table: "Tracks",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Albums",
                columns: table => new
                {
                    AlbumId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    ArtistName = table.Column<string>(type: "text", nullable: false),
                    ReleaseDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CoverUrl = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Albums", x => x.AlbumId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Tracks_AlbumId",
                table: "Tracks",
                column: "AlbumId");

            migrationBuilder.AddForeignKey(
                name: "FK_Tracks_Albums_AlbumId",
                table: "Tracks",
                column: "AlbumId",
                principalTable: "Albums",
                principalColumn: "AlbumId",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Tracks_Albums_AlbumId",
                table: "Tracks");

            migrationBuilder.DropTable(
                name: "Albums");

            migrationBuilder.DropIndex(
                name: "IX_Tracks_AlbumId",
                table: "Tracks");

            migrationBuilder.DropColumn(
                name: "AlbumId",
                table: "Tracks");

            migrationBuilder.DropColumn(
                name: "DiscNumber",
                table: "Tracks");

            migrationBuilder.DropColumn(
                name: "TrackNumber",
                table: "Tracks");
        }
    }
}
