using System.Security.Claims;
using AuthApi.Models;

namespace AuthApi.Services
{
    public interface ITokenService
    {
        Task<(string Token, DateTime ExpiresAtUtc, string JwtId)> CreateAccessTokenAsync(AppUser user);
        string GenerateRefreshToken();
        string HashToken(string token);
        ClaimsPrincipal? GetPrincipalFromExpiredToken(string token);
        Task<bool> IsAccessTokenRevokedAsync(string jwtId, CancellationToken cancellationToken = default);
        Task RevokeAccessTokenAsync(string jwtId, string userId, DateTime expiresAtUtc, string reason, CancellationToken cancellationToken = default);
    }
}
