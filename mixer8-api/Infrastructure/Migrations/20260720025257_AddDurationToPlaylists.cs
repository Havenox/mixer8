using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mixer8.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDurationToPlaylists : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Duration",
                table: "Playlists",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Calcula retroativamente a duração acumulada das playlists com base nas faixas associadas
            migrationBuilder.Sql(@"
                UPDATE ""Playlists"" p
                SET ""Duration"" = COALESCE((
                    SELECT SUM(t.""Duration"")
                    FROM ""PlaylistTracks"" pt
                    JOIN ""Tracks"" t ON pt.""TrackId"" = t.""TrackId""
                    WHERE pt.""PlaylistId"" = p.""PlaylistId""
                ), 0);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Duration",
                table: "Playlists");
        }
    }
}
