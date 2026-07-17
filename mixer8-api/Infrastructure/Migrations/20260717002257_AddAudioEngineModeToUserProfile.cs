using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mixer8.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAudioEngineModeToUserProfile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AudioEngineMode",
                table: "UserProfiles",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AudioEngineMode",
                table: "UserProfiles");
        }
    }
}
