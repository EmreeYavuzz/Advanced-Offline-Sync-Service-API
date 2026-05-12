using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using AuthApi.Data;
using AuthApi.Models;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AuthApi.Tests;

public class AuthFlowTests
{
    [Fact]
    public async Task Register_Login_And_Admin_Endpoints_Work_For_Admin_User()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();

        var registerResponse = await RegisterAsync(client, "admin@example.com", "adminuser", "Admin");

        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);
        var authResponse = await ReadAuthResponseAsync(registerResponse);
        Assert.Contains("Admin", authResponse.Roles);

        var loginResponse = await LoginAsync(client, "admin@example.com", "P@ssw0rd1");

        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        var loginPayload = await ReadAuthResponseAsync(loginResponse);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginPayload.AccessToken);

        var meResponse = await client.GetAsync("/api/protected/me");
        var adminResponse = await client.GetAsync("/api/protected/admin");

        Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, adminResponse.StatusCode);
    }

    [Fact]
    public async Task Refresh_Rotates_Tokens_And_Rejects_Reused_Refresh_Token()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();

        await RegisterAsync(client, "refresh@example.com", "refreshuser", "Admin");
        var loginResponse = await LoginAsync(client, "refresh@example.com", "P@ssw0rd1");
        var loginPayload = await ReadAuthResponseAsync(loginResponse);

        var firstRefreshResponse = await client.PostAsJsonAsync("/api/auth/refresh", new
        {
            refreshToken = loginPayload.RefreshToken
        });

        Assert.Equal(HttpStatusCode.OK, firstRefreshResponse.StatusCode);
        var refreshedPayload = await ReadAuthResponseAsync(firstRefreshResponse);
        Assert.NotEqual(loginPayload.RefreshToken, refreshedPayload.RefreshToken);

        var secondRefreshResponse = await client.PostAsJsonAsync("/api/auth/refresh", new
        {
            refreshToken = loginPayload.RefreshToken
        });

        Assert.Equal(HttpStatusCode.Unauthorized, secondRefreshResponse.StatusCode);
    }

    [Fact]
    public async Task Logout_Blacklists_Current_Access_Token()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();

        await RegisterAsync(client, "logout@example.com", "logoutuser", "Admin");
        var loginResponse = await LoginAsync(client, "logout@example.com", "P@ssw0rd1");
        var loginPayload = await ReadAuthResponseAsync(loginResponse);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginPayload.AccessToken);

        var logoutResponse = await client.PostAsJsonAsync("/api/auth/logout", new
        {
            refreshToken = loginPayload.RefreshToken
        });

        Assert.Equal(HttpStatusCode.OK, logoutResponse.StatusCode);

        var meResponse = await client.GetAsync("/api/protected/me");

        Assert.Equal(HttpStatusCode.Unauthorized, meResponse.StatusCode);
    }

    [Fact]
    public async Task Individual_User_Cannot_Access_Admin_Endpoint()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();

        await RegisterAsync(client, "individual@example.com", "individualuser", "IndividualUser");
        var loginResponse = await LoginAsync(client, "individual@example.com", "P@ssw0rd1");
        var loginPayload = await ReadAuthResponseAsync(loginResponse);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginPayload.AccessToken);

        var adminResponse = await client.GetAsync("/api/protected/admin");
        var individualResponse = await client.GetAsync("/api/protected/individual");

        Assert.Equal(HttpStatusCode.Forbidden, adminResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, individualResponse.StatusCode);
    }

    [Fact]
    public async Task Corporate_User_Can_Access_Corporate_Endpoint_But_Not_Admin()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();

        await RegisterAsync(client, "corporate@example.com", "corporateuser", "CorporateUser");
        var loginResponse = await LoginAsync(client, "corporate@example.com", "P@ssw0rd1");
        var loginPayload = await ReadAuthResponseAsync(loginResponse);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginPayload.AccessToken);

        var corporateResponse = await client.GetAsync("/api/protected/corporate");
        var adminResponse = await client.GetAsync("/api/protected/admin");

        Assert.Equal(HttpStatusCode.OK, corporateResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, adminResponse.StatusCode);
    }

    [Fact]
    public async Task Login_With_Wrong_Password_Returns_Unauthorized()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();

        await RegisterAsync(client, "wrongpass@example.com", "wrongpassuser", "Admin");

        var loginResponse = await LoginAsync(client, "wrongpass@example.com", "WrongPassword123!");

        Assert.Equal(HttpStatusCode.Unauthorized, loginResponse.StatusCode);
    }

    [Fact]
    public async Task Register_With_Invalid_Role_Returns_BadRequest()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();

        var registerResponse = await RegisterAsync(client, "invalidrole@example.com", "invalidroleuser", "SuperAdmin");

        Assert.Equal(HttpStatusCode.BadRequest, registerResponse.StatusCode);
    }

    [Fact]
    public async Task Protected_Request_Writes_Audit_Log_Entry()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();

        await RegisterAsync(client, "audit@example.com", "audituser", "Admin");
        var loginResponse = await LoginAsync(client, "audit@example.com", "P@ssw0rd1");
        var loginPayload = await ReadAuthResponseAsync(loginResponse);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginPayload.AccessToken);

        var meResponse = await client.GetAsync("/api/protected/me");

        Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var auditEntry = dbContext.AuditLogs
            .OrderByDescending(log => log.Id)
            .FirstOrDefault(log => log.Endpoint == "/api/protected/me");

        Assert.NotNull(auditEntry);
        Assert.Equal("GET", auditEntry.Method);
        Assert.True(auditEntry.IsSuccess);
        Assert.Equal(loginPayload.UserId, auditEntry.UserId);
    }

    [Fact]
    public async Task Logout_Persists_Blacklisted_Token_In_Database()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();

        await RegisterAsync(client, "blacklist@example.com", "blacklistuser", "Admin");
        var loginResponse = await LoginAsync(client, "blacklist@example.com", "P@ssw0rd1");
        var loginPayload = await ReadAuthResponseAsync(loginResponse);
        var jwtId = ReadJwtId(loginPayload.AccessToken);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginPayload.AccessToken);

        var logoutResponse = await client.PostAsJsonAsync("/api/auth/logout", new
        {
            refreshToken = loginPayload.RefreshToken
        });

        Assert.Equal(HttpStatusCode.OK, logoutResponse.StatusCode);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var revokedToken = dbContext.RevokedAccessTokens.FirstOrDefault(token => token.JwtId == jwtId);

        Assert.NotNull(revokedToken);
        Assert.Equal(loginPayload.UserId, revokedToken.UserId);
        Assert.Equal("Logged out", revokedToken.Reason);
    }

    [Fact]
    public async Task Login_Is_Rate_Limited_After_Too_Many_Attempts()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();

        await RegisterAsync(client, "ratelimit@example.com", "ratelimituser", "Admin");

        HttpResponseMessage? lastResponse = null;

        for (var attempt = 0; attempt < 6; attempt++)
        {
            lastResponse = await LoginAsync(client, "ratelimit@example.com", "WrongPassword123!");
        }

        Assert.NotNull(lastResponse);
        Assert.Equal(HttpStatusCode.TooManyRequests, lastResponse.StatusCode);
    }

    private static CustomWebApplicationFactory CreateFactory()
    {
        return new CustomWebApplicationFactory();
    }

    private static Task<HttpResponseMessage> RegisterAsync(HttpClient client, string email, string userName, string role)
    {
        return client.PostAsJsonAsync("/api/auth/register", new
        {
            fullName = "Test User",
            email,
            userName,
            password = "P@ssw0rd1",
            confirmPassword = "P@ssw0rd1",
            role
        });
    }

    private static Task<HttpResponseMessage> LoginAsync(HttpClient client, string email, string password)
    {
        return client.PostAsJsonAsync("/api/auth/login", new
        {
            email,
            password
        });
    }

    private static async Task<AuthResponsePayload> ReadAuthResponseAsync(HttpResponseMessage response)
    {
        var payload = await response.Content.ReadFromJsonAsync<AuthResponsePayload>(new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        Assert.NotNull(payload);
        Assert.False(string.IsNullOrWhiteSpace(payload.AccessToken));
        Assert.False(string.IsNullOrWhiteSpace(payload.RefreshToken));

        return payload;
    }

    private static string ReadJwtId(string accessToken)
    {
        var token = new JwtSecurityTokenHandler().ReadJwtToken(accessToken);
        var jwtId = token.Id;

        Assert.False(string.IsNullOrWhiteSpace(jwtId));

        return jwtId;
    }

    private sealed class AuthResponsePayload
    {
        public string AccessToken { get; init; } = string.Empty;
        public string RefreshToken { get; init; } = string.Empty;
        public string UserId { get; init; } = string.Empty;
        public string[] Roles { get; init; } = [];
    }
}
