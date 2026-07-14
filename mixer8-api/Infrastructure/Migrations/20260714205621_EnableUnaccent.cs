using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mixer8.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class EnableUnaccent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS unaccent;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP EXTENSION IF EXISTS unaccent;");
        }
    }
}
