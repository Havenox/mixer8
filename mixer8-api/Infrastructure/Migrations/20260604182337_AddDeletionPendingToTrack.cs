using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mixer8.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDeletionPendingToTrack : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "DeletionPending",
                table: "Tracks",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DeletionPending",
                table: "Tracks");
        }
    }
}
