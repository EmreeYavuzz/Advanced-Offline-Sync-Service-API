using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using AuthApi.Configuration;
using AuthApi.Data;
using AuthApi.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace AuthApi.Services
{
    public class TokenService(
        IOptions<JwtOptions> jwtOptions,
        UserManager<AppUser> userManager,
        AppDbContext dbContext) : ITokenService
    {
        private readonly JwtOptions _jwtOptions = jwtOptions.Value;
        private readonly UserManager<AppUser> _userManager = userManager;
        private readonly AppDbContext _dbContext = dbContext;

        public async Task<(string Token, DateTime ExpiresAtUtc, string JwtId)> CreateAccessTokenAsync(AppUser user)
        {
            var roles = await _userManager.GetRolesAsync(user);
            var jwtId = Guid.NewGuid().ToString();
            var expiresAtUtc = DateTime.UtcNow.AddMinutes(_jwtOptions.AccessTokenExpiration);

            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, user.Id),
                new(ClaimTypes.NameIdentifier, user.Id),
                new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
                new(ClaimTypes.Email, user.Email ?? string.Empty),
                new(JwtRegisteredClaimNames.Jti, jwtId)
            };

            claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtOptions.Key));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _jwtOptions.Issuer,
                audience: _jwtOptions.Audience,
                claims: claims,
                expires: expiresAtUtc,
                signingCredentials: credentials);

            return (new JwtSecurityTokenHandler().WriteToken(token), expiresAtUtc, jwtId);
        }

        public string GenerateRefreshToken()
        {
            return Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        }

        public string HashToken(string token)
        {
            var hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
            return Convert.ToHexString(hashBytes);
        }

        public ClaimsPrincipal? GetPrincipalFromExpiredToken(string token)
        {
            var validationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = false,
                ValidateIssuerSigningKey = true,
                ValidIssuer = _jwtOptions.Issuer,
                ValidAudience = _jwtOptions.Audience,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtOptions.Key))
            };

            return new JwtSecurityTokenHandler().ValidateToken(token, validationParameters, out _);
        }

        public Task<bool> IsAccessTokenRevokedAsync(string jwtId, CancellationToken cancellationToken = default)
        {
            return _dbContext.RevokedAccessTokens.AnyAsync(token => token.JwtId == jwtId, cancellationToken);
        }

        public async Task RevokeAccessTokenAsync(string jwtId, string userId, DateTime expiresAtUtc, string reason, CancellationToken cancellationToken = default)
        {
            var exists = await _dbContext.RevokedAccessTokens.AnyAsync(token => token.JwtId == jwtId, cancellationToken);
            if (exists)
            {
                return;
            }

            _dbContext.RevokedAccessTokens.Add(new RevokedAccessToken
            {
                JwtId = jwtId,
                UserId = userId,
                ExpiresAtUtc = expiresAtUtc,
                RevokedAtUtc = DateTime.UtcNow,
                Reason = reason
            });

            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }
}
