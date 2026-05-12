using System.Security.Claims;
using AuthApi.Data;
using AuthApi.Models;

namespace AuthApi.Middleware
{
    public class AuditLogMiddleware(RequestDelegate next)
    {
        private readonly RequestDelegate _next = next;

        public async Task InvokeAsync(HttpContext context, AppDbContext dbContext)
        {
            await _next(context);

            if (!context.Request.Path.StartsWithSegments("/api"))
            {
                return;
            }

            var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
            var endpoint = context.Request.Path.Value ?? string.Empty;

            dbContext.AuditLogs.Add(new AuditLog
            {
                UserId = userId,
                Endpoint = endpoint,
                Method = context.Request.Method,
                TimestampUtc = DateTime.UtcNow,
                IpAddress = context.Connection.RemoteIpAddress?.ToString(),
                IsSuccess = context.Response.StatusCode < StatusCodes.Status400BadRequest,
                Detail = $"StatusCode:{context.Response.StatusCode}"
            });

            await dbContext.SaveChangesAsync();
        }
    }
}
