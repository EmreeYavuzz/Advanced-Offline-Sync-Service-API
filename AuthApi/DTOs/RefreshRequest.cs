using System.ComponentModel.DataAnnotations;

namespace AuthApi.DTOs
{
    public class RefreshRequest
    {
        [Required]
        public string RefreshToken { get; set; } = string.Empty;
    }
}
