using System.ComponentModel.DataAnnotations;

namespace AuthApi.Models
{
    public class AuditLog
    {
        [Key]
        public long Id { get; set; }
        public string? UserId { get; set; }
        public string Endpoint { get; set; } = string.Empty;
        public string Method { get; set; } = string.Empty;
        public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
        public string? IpAddress { get; set; }
        public bool IsSuccess { get; set; }
        public string? Detail { get; set; }

        public AppUser? User { get; set; }
    }
}
