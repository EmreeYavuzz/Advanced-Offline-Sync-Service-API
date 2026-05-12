using System.ComponentModel.DataAnnotations;

namespace AuthApi.Models
{
    public class RevokedAccessToken
    {
        [Key]
        public long Id { get; set; }
        public string JwtId { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
        public DateTime ExpiresAtUtc { get; set; }
        public DateTime RevokedAtUtc { get; set; } = DateTime.UtcNow;
        public string? Reason { get; set; }

        public AppUser User { get; set; } = null!;
    }
}
