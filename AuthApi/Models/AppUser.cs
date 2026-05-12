using Microsoft.AspNetCore.Identity;

namespace AuthApi.Models
{
    public class AppUser : IdentityUser
    {
        public string? FullName { get; set; }
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
        public ICollection<RefreshToken> RefreshTokens { get; set; } = [];
        public ICollection<AuditLog> AuditLogs { get; set; } = [];
        public ICollection<RevokedAccessToken> RevokedAccessTokens { get; set; } = [];
    }
}
