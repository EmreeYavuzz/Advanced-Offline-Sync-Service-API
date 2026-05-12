using System.ComponentModel.DataAnnotations;

namespace AuthApi.DTOs
{
    public class LogoutRequest
    {
        [Required]
        public string RefreshToken { get; set; } = string.Empty;
    }
}
