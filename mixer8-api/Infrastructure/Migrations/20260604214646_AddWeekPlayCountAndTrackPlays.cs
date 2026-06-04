using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mixer8.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWeekPlayCountAndTrackPlays : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "WeekPlayCount",
                table: "Tracks",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.CreateTable(
                name: "TrackPlays",
                columns: table => new
                {
                    TrackPlayId = table.Column<Guid>(type: "uuid", nullable: false),
                    TrackId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlayedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrackPlays", x => x.TrackPlayId);
                    table.ForeignKey(
                        name: "FK_TrackPlays_Tracks_TrackId",
                        column: x => x.TrackId,
                        principalTable: "Tracks",
                        principalColumn: "TrackId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Tracks_WeekPlayCount",
                table: "Tracks",
                column: "WeekPlayCount");

            migrationBuilder.CreateIndex(
                name: "IX_TrackPlays_PlayedAt",
                table: "TrackPlays",
                column: "PlayedAt");

            migrationBuilder.CreateIndex(
                name: "IX_TrackPlays_TrackId",
                table: "TrackPlays",
                column: "TrackId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TrackPlays");

            migrationBuilder.DropIndex(
                name: "IX_Tracks_WeekPlayCount",
                table: "Tracks");

            migrationBuilder.DropColumn(
                name: "WeekPlayCount",
                table: "Tracks");
        }
    }
}
