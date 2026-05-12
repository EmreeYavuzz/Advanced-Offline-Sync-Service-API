using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using AuthApi.Configuration;
using AuthApi.Constants;
using AuthApi.Data;
using AuthApi.DTOs;
using AuthApi.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AuthApi.Services
{
    public class AuthService(
        UserManager<AppUser> userManager,
        AppDbContext dbContext,
        ITokenService tokenService,
        IOptions<JwtOptions> jwtOptions) : IAuthService
    {
        private readonly UserManager<AppUser> _userManager = userManager;
        private readonly AppDbContext _dbContext = dbContext;
        private readonly ITokenService _tokenService = tokenService;
        private readonly JwtOptions _jwtOptions = jwtOptions.Value;

        public async Task<ServiceResult<AuthResponse>> RegisterAsync(RegisterRequest request, string ipAddress, CancellationToken cancellationToken = default)
        {
            if (!AuthRoles.All.Contains(request.Role))
            {
                return ServiceResult<AuthResponse>.Failure($"Invalid role. Allowed roles: {string.Join(", ", AuthRoles.All)}");
            }

            var existingUser = await _userManager.FindByEmailAsync(request.Email);
            if (existingUser is not null)
            {
                return ServiceResult<AuthResponse>.Failure("A user with this email already exists.");
            }

            var user = new AppUser
            {
                Email = request.Email,
                UserName = request.UserName,
                FullName = request.FullName
            };

            var createResult = await _userManager.CreateAsync(user, request.Password);
            if (!createResult.Succeeded)
            {
                return ServiceResult<AuthResponse>.Failure(createResult.Errors.Select(error => error.Description).ToArray());
            }

            var roleResult = await _userManager.AddToRoleAsync(user, request.Role);
            if (!roleResult.Succeeded)
            {
                await _userManager.DeleteAsync(user);
                return ServiceResult<AuthResponse>.Failure(roleResult.Errors.Select(error => error.Description).ToArray());
            }

            var authResponse = await IssueTokensAsync(user, ipAddress, cancellationToken);
            return ServiceResult<AuthResponse>.Success(authResponse, "User registered successfully.");
        }

        public async Task<ServiceResult<AuthResponse>> LoginAsync(LoginRequest request, string ipAddress, CancellationToken cancellationToken = default)
        {
            var user = await _userManager.FindByEmailAsync(request.Email);
            if (user is null)
            {
                return ServiceResult<AuthResponse>.Failure("Invalid email or password.");
            }

            var validPassword = await _userManager.CheckPasswordAsync(user, request.Password);
            if (!validPassword)
            {
                return ServiceResult<AuthResponse>.Failure("Invalid email or password.");
            }

            var authResponse = await IssueTokensAsync(user, ipAddress, cancellationToken);
            return ServiceResult<AuthResponse>.Success(authResponse, "Login successful.");
        }

        public async Task<ServiceResult<AuthResponse>> RefreshAsync(RefreshRequest request, string ipAddress, CancellationToken cancellationToken = default)
        {
            var refreshTokenHash = _tokenService.HashToken(request.RefreshToken);
            var existingToken = await _dbContext.RefreshTokens
                .Include(token => token.User)
                .FirstOrDefaultAsync(token => token.Token == refreshTokenHash, cancellationToken);

            if (existingToken is null)
            {
                return ServiceResult<AuthResponse>.Failure("Refresh token not found.");
            }

            if (!existingToken.IsActive)
            {
                return ServiceResult<AuthResponse>.Failure("Refresh token is no longer active.");
            }

            existingToken.IsRevoked = true;
            existingToken.RevokedDate = DateTime.UtcNow;
            existingToken.RevokedByIp = ipAddress;

            var rawRefreshToken = _tokenService.GenerateRefreshToken();
            existingToken.ReplacedByToken = _tokenService.HashToken(rawRefreshToken);

            var newRefreshToken = new RefreshToken
            {
                Token = existingToken.ReplacedByToken,
                UserId = existingToken.UserId,
                CreatedByIp = ipAddress,
                ExpiryDate = DateTime.UtcNow.AddMinutes(_jwtOptions.RefreshTokenExpiration)
            };

            _dbContext.RefreshTokens.Add(newRefreshToken);
            await _dbContext.SaveChangesAsync(cancellationToken);

            var authResponse = await CreateAuthResponseAsync(existingToken.User, rawRefreshToken);
            return ServiceResult<AuthResponse>.Success(authResponse, "Token refreshed successfully.");
        }

        public async Task<ServiceResult> LogoutAsync(string refreshToken, ClaimsPrincipal principal, string ipAddress, CancellationToken cancellationToken = default)
        {
            var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
            var jwtId = principal.FindFirstValue(JwtRegisteredClaimNames.Jti);
            var expValue = principal.FindFirstValue(JwtRegisteredClaimNames.Exp);

            if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(jwtId) || string.IsNullOrWhiteSpace(expValue))
            {
                return ServiceResult.Failure("Unable to resolve access token claims.");
            }

            var refreshTokenHash = _tokenService.HashToken(refreshToken);
            var existingToken = await _dbContext.RefreshTokens
                .FirstOrDefaultAsync(token => token.Token == refreshTokenHash && token.UserId == userId, cancellationToken);

            if (existingToken is null)
            {
                return ServiceResult.Failure("Refresh token not found.");
            }

            if (!existingToken.IsRevoked)
            {
                existingToken.IsRevoked = true;
                existingToken.RevokedDate = DateTime.UtcNow;
                existingToken.RevokedByIp = ipAddress;
            }

            var expiresAtUtc = DateTimeOffset.FromUnixTimeSeconds(long.Parse(expValue)).UtcDateTime;
            await _tokenService.RevokeAccessTokenAsync(jwtId, userId, expiresAtUtc, "Logged out", cancellationToken);
            await _dbContext.SaveChangesAsync(cancellationToken);

            return ServiceResult.Success("Logout successful.");
        }

        private async Task<AuthResponse> IssueTokensAsync(AppUser user, string ipAddress, CancellationToken cancellationToken)
        {
            var rawRefreshToken = _tokenService.GenerateRefreshToken();
            var hashedRefreshToken = _tokenService.HashToken(rawRefreshToken);

            var refreshToken = new RefreshToken
            {
                Token = hashedRefreshToken,
                UserId = user.Id,
                ExpiryDate = DateTime.UtcNow.AddMinutes(_jwtOptions.RefreshTokenExpiration),
                CreatedByIp = ipAddress
            };

            _dbContext.RefreshTokens.Add(refreshToken);
            await _dbContext.SaveChangesAsync(cancellationToken);

            return await CreateAuthResponseAsync(user, rawRefreshToken);
        }

        private async Task<AuthResponse> CreateAuthResponseAsync(AppUser user, string rawRefreshToken)
        {
            var roles = await _userManager.GetRolesAsync(user);
            var accessToken = await _tokenService.CreateAccessTokenAsync(user);

            return new AuthResponse
            {
                AccessToken = accessToken.Token,
                RefreshToken = rawRefreshToken,
                AccessTokenExpiresAtUtc = accessToken.ExpiresAtUtc,
                Email = user.Email ?? string.Empty,
                UserId = user.Id,
                Roles = roles.ToArray()
            };
        }
    }
}
