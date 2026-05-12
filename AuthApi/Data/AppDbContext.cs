using AuthApi.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace AuthApi.Data
{
    public class AppDbContext : IdentityDbContext<AppUser>
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<RefreshToken> RefreshTokens { get; set; }
        public DbSet<AuditLog> AuditLogs { get; set; }
        public DbSet<RevokedAccessToken> RevokedAccessTokens { get; set; }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            builder.Entity<RefreshToken>()
                .HasOne(rt => rt.User)
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(rt => rt.UserId);

            builder.Entity<RefreshToken>()
                .HasIndex(rt => rt.Token)
                .IsUnique();

            builder.Entity<RefreshToken>()
                .HasIndex(rt => new { rt.UserId, rt.IsRevoked });

            builder.Entity<AuditLog>()
                .HasOne(log => log.User)
                .WithMany(user => user.AuditLogs)
                .HasForeignKey(log => log.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.Entity<AuditLog>()
                .HasIndex(log => log.TimestampUtc);

            builder.Entity<RevokedAccessToken>()
                .HasOne(token => token.User)
                .WithMany(user => user.RevokedAccessTokens)
                .HasForeignKey(token => token.UserId);

            builder.Entity<RevokedAccessToken>()
                .HasIndex(token => token.JwtId)
                .IsUnique();

            builder.Entity<RevokedAccessToken>()
                .HasIndex(token => token.ExpiresAtUtc);
        }
    }
}
