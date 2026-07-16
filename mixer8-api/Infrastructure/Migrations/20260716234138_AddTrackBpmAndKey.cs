using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mixer8.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTrackBpmAndKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Bpm",
                table: "Tracks",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Key",
                table: "Tracks",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Bpm",
                table: "Tracks");

            migrationBuilder.DropColumn(
                name: "Key",
                table: "Tracks");
        }
    }
}
