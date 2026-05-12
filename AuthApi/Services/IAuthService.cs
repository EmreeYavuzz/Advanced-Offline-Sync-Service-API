using System.Security.Claims;
using AuthApi.DTOs;

namespace AuthApi.Services
{
    public interface IAuthService
    {
        Task<ServiceResult<AuthResponse>> RegisterAsync(RegisterRequest request, string ipAddress, CancellationToken cancellationToken = default);
        Task<ServiceResult<AuthResponse>> LoginAsync(LoginRequest request, string ipAddress, CancellationToken cancellationToken = default);
        Task<ServiceResult<AuthResponse>> RefreshAsync(RefreshRequest request, string ipAddress, CancellationToken cancellationToken = default);
        Task<ServiceResult> LogoutAsync(string refreshToken, ClaimsPrincipal principal, string ipAddress, CancellationToken cancellationToken = default);
    }
}
