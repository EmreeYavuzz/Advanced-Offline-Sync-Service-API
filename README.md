# Advanced Identity Auth API

This project implements JWT authentication with ASP.NET Core Identity, PostgreSQL, EF Core migrations, role-based authorization, refresh token rotation, audit logging, login rate limiting, and access-token blacklisting.

## Features

- `register`, `login`, `refresh`, and `logout` endpoints
- Three roles: `Admin`, `IndividualUser`, `CorporateUser`
- Refresh tokens stored in PostgreSQL and revocable
- Access token blacklist using JWT `jti`
- IP-based rate limiting for the login endpoint
- Audit log table for API access history
- Scalar/OpenAPI for exploring endpoints

## Project Structure

- `AuthApi/`: API project
- `AuthApi.Tests/`: integration tests

## Setup

1. Update `ConnectionStrings:DefaultConnection` in `AuthApi/appsettings.json` or user secrets.
2. Ensure PostgreSQL is running and the target database can be created.
3. From repo root, run:

```powershell
dotnet restore
dotnet ef database update --project AuthApi
dotnet run --project AuthApi
```

Application runs pending migrations on startup and seeds three roles automatically.

## Auth Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

`register`, `login`, and `refresh` return:

- `accessToken`
- `refreshToken`
- `accessTokenExpiresAtUtc`
- `email`
- `userId`
- `roles`

## Protected Endpoints

- `GET /api/protected/me`
- `GET /api/protected/admin`
- `GET /api/protected/individual`
- `GET /api/protected/corporate`

## Role Seed Behavior

These roles are created on startup if they do not exist:

- `Admin`
- `IndividualUser`
- `CorporateUser`

## 401 vs 403

- Expired, invalid, or blacklisted access token returns `401 Unauthorized`.
- Valid access token with missing required role returns `403 Forbidden`.

## Refresh Token Behavior

- Refresh tokens are stored hashed in database.
- `refresh` revokes old refresh token and issues new one.
- `logout` revokes submitted refresh token and blacklists current access token.

## Rate Limiting

`POST /api/auth/login` is limited per client IP. Exceeding limit returns `429 Too Many Requests`.

## Audit Logging

Each `/api/*` request writes audit log entry containing user, endpoint, method, IP, timestamp, and result status.

## Manual Testing Checklist

Keep `dotnet run --project AuthApi` open while testing. API listens on `http://localhost:5222` and OpenAPI UI is available at `http://localhost:5222/scalar/v1`.

You can test API in either of these ways:

- Use Scalar UI in browser
- Use `AuthApi/AuthApi.http` file from VS Code with REST Client extension

### 1. Register admin user

Send `POST /api/auth/register` with:

```json
{
  "fullName": "Admin User",
  "email": "admin@example.com",
  "userName": "adminuser",
  "password": "P@ssw0rd1",
  "confirmPassword": "P@ssw0rd1",
  "role": "Admin"
}
```

Expected result:

- `200 OK`
- Response contains `accessToken`, `refreshToken`, `accessTokenExpiresAtUtc`, `email`, `userId`, `roles`
- `roles` contains `Admin`

If user already exists, API returns `400 Bad Request`. In that case, continue with login step.

### 2. Login with admin user

Send `POST /api/auth/login` with:

```json
{
  "email": "admin@example.com",
  "password": "P@ssw0rd1"
}
```

Expected result:

- `200 OK`
- Response contains new `accessToken`
- Response contains `refreshToken`

Save both token values for next steps.

### 3. Call authenticated `me` endpoint

Send `GET /api/protected/me` with:

```http
Authorization: Bearer {accessToken}
```

Expected result:

- `200 OK`
- Response contains `Authenticated request succeeded.`

This proves JWT authentication works for protected endpoint.

### 4. Call admin-only endpoint

Send `GET /api/protected/admin` with:

```http
Authorization: Bearer {accessToken}
```

Expected result:

- `200 OK`
- Response contains `Admin endpoint reached.`

This proves role-based authorization works for admin user.

### 5. Refresh tokens

Send `POST /api/auth/refresh` with:

```json
{
  "refreshToken": "{refreshToken}"
}
```

Expected result:

- `200 OK`
- Response contains new `accessToken`
- Response contains new `refreshToken`

Save new token pair. Old refresh token should no longer be valid.

### 6. Logout

Send `POST /api/auth/logout` with:

```http
Authorization: Bearer {latestAccessToken}
```

and body:

```json
{
  "refreshToken": "{latestRefreshToken}"
}
```

Expected result:

- `200 OK`
- Response contains success message

This revokes submitted refresh token and blacklists current access token.

### 7. Verify old access token no longer works

Send `GET /api/protected/me` again with same access token used for logout.

Expected result:

- `401 Unauthorized`

This proves access-token blacklisting is active.

### 8. Verify role-based `403 Forbidden`

Register and login with individual user:

```json
{
  "fullName": "Individual User",
  "email": "individual@example.com",
  "userName": "individualuser",
  "password": "P@ssw0rd1",
  "confirmPassword": "P@ssw0rd1",
  "role": "IndividualUser"
}
```

Then test:

- `GET /api/protected/admin` with individual user's access token
- Expected: `403 Forbidden`
- `GET /api/protected/individual` with individual user's access token
- Expected: `200 OK`

This proves API returns `403` for valid tokens that do not have required role.

### 9. Negative tests

Use these quick checks to validate error handling:

- Login with wrong password
- Expected: `401 Unauthorized`
- Call protected endpoint with malformed or expired access token
- Expected: `401 Unauthorized`
- Call `POST /api/auth/refresh` twice with same refresh token
- First call: `200 OK`
- Second call: `401 Unauthorized`
- Send too many login requests from same IP within one minute
- Expected: `429 Too Many Requests`

### Expected status code summary

- `200 OK`: request succeeded
- `400 Bad Request`: invalid register request or logout request
- `401 Unauthorized`: invalid login, invalid token, expired token, revoked token, or invalid refresh token
- `403 Forbidden`: valid token, but user does not have required role
- `429 Too Many Requests`: login rate limit exceeded

## Automated Test Coverage

Repository also includes integration tests for main authentication flows in `AuthApi.Tests`.

Run them with:

```powershell
dotnet test AuthApi.Tests/AuthApi.Tests.csproj
```

Current automated coverage includes:

- admin register, login, and protected endpoint access
- refresh token rotation and rejection of reused refresh tokens
- logout blacklisting for current access token
- `IndividualUser` role restriction against admin endpoints
- `CorporateUser` access to its own endpoint and rejection from admin endpoints
- wrong password login returning `401 Unauthorized`
- invalid role registration returning `400 Bad Request`
- audit log creation for protected API requests
- revoked access token persistence in database after logout
- login rate limiting returning `429 Too Many Requests`

Expected result:

- all tests pass
- output ends with `Failed: 0`
