# AuthApi JWT Authentication

This project implements JWT authentication with ASP.NET Core Identity, PostgreSQL, EF Core migrations, role-based authorization, refresh token rotation, audit logging, login rate limiting, and access-token blacklisting.

## Features

- `register`, `login`, `refresh`, and `logout` endpoints
- Three roles: `Admin`, `IndividualUser`, `CorporateUser`
- Refresh tokens stored in PostgreSQL and revocable
- Access token blacklist using JWT `jti`
- IP-based rate limiting for the login endpoint
- Audit log table for API access history
- Scalar/OpenAPI for exploring endpoints

## Setup

1. Update `ConnectionStrings:DefaultConnection` in `appsettings.json` or user secrets.
2. Ensure PostgreSQL is running and the target database can be created.
3. From the `AuthApi` folder, run:

```powershell
dotnet restore
dotnet ef migrations add InitialAuthSchema
dotnet ef database update
dotnet run
```

The application runs pending migrations on startup and seeds the three roles automatically.

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

- Refresh tokens are stored hashed in the database.
- `refresh` revokes the old refresh token and issues a new one.
- `logout` revokes the submitted refresh token and blacklists the current access token.

## Rate Limiting

`POST /api/auth/login` is limited per client IP. Exceeding the limit returns `429 Too Many Requests`.

## Audit Logging

Each `/api/*` request writes an audit log entry containing user, endpoint, method, IP, timestamp, and result status.

## Manual Testing Checklist

Keep `dotnet run` open while testing. The API listens on `http://localhost:5222` and the OpenAPI UI is available at `http://localhost:5222/scalar/v1`.

You can test the API in either of these ways:

- Use the Scalar UI in your browser
- Use the `AuthApi.http` file from VS Code with the REST Client extension

### 1. Register an admin user

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

If the user already exists, the API returns `400 Bad Request`. In that case, continue with the login step.

### 2. Login with the admin user

Send `POST /api/auth/login` with:

```json
{
  "email": "admin@example.com",
  "password": "P@ssw0rd1"
}
```

Expected result:

- `200 OK`
- Response contains a new `accessToken`
- Response contains a `refreshToken`

Save both token values for the next steps.

### 3. Call the authenticated `me` endpoint

Send `GET /api/protected/me` with:

```http
Authorization: Bearer {accessToken}
```

Expected result:

- `200 OK`
- Response contains `Authenticated request succeeded.`

This proves that JWT authentication works for a protected endpoint.

### 4. Call the admin-only endpoint

Send `GET /api/protected/admin` with:

```http
Authorization: Bearer {accessToken}
```

Expected result:

- `200 OK`
- Response contains `Admin endpoint reached.`

This proves that role-based authorization works for an admin user.

### 5. Refresh the tokens

Send `POST /api/auth/refresh` with:

```json
{
  "refreshToken": "{refreshToken}"
}
```

Expected result:

- `200 OK`
- Response contains a new `accessToken`
- Response contains a new `refreshToken`

Save the new token pair. The old refresh token should no longer be valid.

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
- Response contains a success message

This revokes the submitted refresh token and blacklists the current access token.

### 7. Verify that the old access token no longer works

Send `GET /api/protected/me` again with the same access token used for logout.

Expected result:

- `401 Unauthorized`

This proves that access-token blacklisting is active.

### 8. Verify role-based `403 Forbidden`

Register and login with an individual user:

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

- `GET /api/protected/admin` with the individual user's access token
- Expected: `403 Forbidden`
- `GET /api/protected/individual` with the individual user's access token
- Expected: `200 OK`

This proves the API returns `403` for valid tokens that do not have the required role.

### 9. Negative tests

Use these quick checks to validate error handling:

- Login with a wrong password
  - Expected: `401 Unauthorized`
- Call a protected endpoint with a malformed or expired access token
  - Expected: `401 Unauthorized`
- Call `POST /api/auth/refresh` twice with the same refresh token
  - First call: `200 OK`
  - Second call: `401 Unauthorized`
- Send too many login requests from the same IP within one minute
  - Expected: `429 Too Many Requests`

### Expected status code summary

- `200 OK`: request succeeded
- `400 Bad Request`: invalid register request or logout request
- `401 Unauthorized`: invalid login, invalid token, expired token, revoked token, or invalid refresh token
- `403 Forbidden`: valid token, but user does not have the required role
- `429 Too Many Requests`: login rate limit exceeded

## Automated Test Coverage

The repository also includes integration tests for the main authentication flows in `AuthApi.Tests`.

Run them with:

```powershell
dotnet test AuthApi.Tests\AuthApi.Tests.csproj
```

Current automated coverage includes:

- admin register, login, and protected endpoint access
- refresh token rotation and rejection of reused refresh tokens
- logout blacklisting for the current access token
- `IndividualUser` role restriction against admin endpoints
- `CorporateUser` access to its own endpoint and rejection from admin endpoints
- wrong password login returning `401 Unauthorized`
- invalid role registration returning `400 Bad Request`
- audit log creation for protected API requests
- revoked access token persistence in the database after logout
- login rate limiting returning `429 Too Many Requests`

Expected result:

- all tests pass
- output ends with `Failed: 0`
