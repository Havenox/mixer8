using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mixer8.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddStemWaveforms : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StemWaveforms",
                columns: table => new
                {
                    StemId = table.Column<Guid>(type: "uuid", nullable: false),
                    Points = table.Column<List<int>>(type: "integer[]", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StemWaveforms", x => x.StemId);
                    table.ForeignKey(
                        name: "FK_StemWaveforms_Stems_StemId",
                        column: x => x.StemId,
                        principalTable: "Stems",
                        principalColumn: "StemId",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StemWaveforms");
        }
    }
}
