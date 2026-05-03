# OAuth 2.0 Authentication System - Implementation Guide

## Overview

This document provides a comprehensive guide for the SwayAuth OAuth 2.0 authentication system, including architecture, configuration, deployment, and security considerations.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Application                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Authorization   │
                    │   Endpoint       │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                     │
   ┌────▼──────┐       ┌──────▼────┐       ┌──────▼──────┐
   │  Token     │       │  Revoke   │       │ Introspect  │
   │ Endpoint   │       │ Endpoint  │       │ Endpoint    │
   └────┬──────┘       └────┬─────┘       └──────┬──────┘
        │                   │                     │
        └───────────────────┼─────────────────────┘
                            │
                    ┌───────▼────────┐
                    │  Authorization │
                    │  Code Storage  │
                    └────────────────┘
                            │
        ┌───────────────────┼──────────────────┐
        │                   │                  │
   ┌────▼──────┐       ┌─────▼────┐      ┌────▼────┐
   │  Session  │       │  Refresh  │      │ Revoked  │
   │  Storage  │       │  Tokens   │      │  Tokens  │
   └───────────┘       └───────────┘      └──────────┘
        │                   │
        └───────────────────┴──────────────────┐
                                               │
                                     ┌────────▼───────┐
                                     │   Audit Log    │
                                     └────────────────┘
```

## Core Components

### 1. Authorization Code Flow

**Endpoint:** `POST /v1/oauth/authorize`

**PKCE Implementation:**
- Code verifier: Random 32-byte value (base64url-encoded)
- Code challenge: SHA256(code_verifier) in base64url format
- Method: S256 (SHA256) - only method supported

**Code Generation:**
```
Authorization Code = base64url(randomBytes(32))
Code Hash = SHA256(code + PEPPER)  // Pepper stored in env
Storage: 10-minute expiration, single-use only
```

**Database Storage:**
```prisma
model OAuthAuthorizationCode {
  code_hash        String    @unique
  code_challenge   String
  expires_at       DateTime  // 10 minutes
  used_at          DateTime? // Mark as used after exchange
  user_id          String?
  organization_id  String
  ip_address       String
  user_agent       String
}
```

### 2. Token Exchange

**Endpoint:** `POST /v1/oauth/token`

**Grant Type: authorization_code**

```
Request:
{
  "grant_type": "authorization_code",
  "client_id": "org-token-1",
  "redirect_uri": "https://example.com/callback",
  "code": "auth-code-abc123",
  "code_verifier": "code-verifier-value"
}

Response:
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 900,
  "scope": "read write"
}

Headers (Set-Cookie):
- swayauth_rt (refresh token, HTTP-only)
- swayauth_sid (session ID, HTTP-only)
- swayauth_csrf (CSRF token, not HTTP-only)
```

**Access Token Claims (JWT):**
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "scope": ["read", "write"],
  "permissions": ["read", "write", "delete"],
  "status": "active",
  "organization_id": "org-1",
  "organization_token_id": "org-token-1",
  "company_id": "company-1",
  "access": "level_1",
  "aud": "org-token-1",
  "exp": 1234567890,
  "iat": 1234566990,
  "jti": "unique-id"
}
```

**Access Token Configuration:**
- Algorithm: RS256 (RSA-SHA256)
- Expiration: 15-60 minutes (configurable)
- Signing: Private key from environment
- Verification: Public key from environment

### 3. Refresh Token Management

**Endpoint:** `POST /v1/oauth/token` (grant_type: refresh_token)

**Database Storage:**
```prisma
model OAuthRefreshToken {
  token_hash    String @unique
  session_id    String
  user_id       String
  expires_at    DateTime  // 7-30 days
  revoked_at    DateTime?
  created_at    DateTime
}

model OAuthSession {
  user_id                 String
  device_fingerprint_hash String  // Device binding
  csrf_token_hash         String  // CSRF protection
  last_seen               DateTime
  revoked_at              DateTime?
}
```

**Refresh Logic:**
1. Validate refresh token exists and not expired
2. Verify device fingerprint matches (session binding)
3. Verify CSRF token (from header)
4. Revoke old refresh token
5. Issue new refresh token
6. Update session with new CSRF token

### 4. Token Revocation

**Endpoint:** `POST /v1/oauth/revoke`

**Access Token Revocation:**
- Extract JTI from token
- Store in `OAuthRevokedAccessToken` table
- Indexed by expiration time for cleanup

**Refresh Token Revocation:**
- Mark token as revoked
- Revoke associated session
- Clear HTTP-only cookies

### 5. Token Introspection

**Endpoint:** `POST /v1/oauth/introspect`

**Implementation:**
1. Verify JWT signature with public key
2. Check expiration time
3. Check if JTI is in revocation list
4. Return token claims if active

**Response:**
```json
{
  "active": true,
  "scope": "read write",
  "client_id": "org-token-1",
  "username": "user@example.com",
  "sub": "user-id",
  "exp": 1234567890,
  "iat": 1234566990
}
```

## Password Reset Flow

### Request Password Reset

**Endpoint:** `POST /v1/oauth/password-reset/request`

**Process:**
1. Validate organization token
2. Look up user by email (no error if not found for security)
3. Generate reset token: `base64url(randomBytes(32))`
4. Hash token: `SHA256(token + PEPPER)`
5. Store with 15-minute expiration
6. Send email with reset link
7. Log audit event

**Database Storage:**
```prisma
model PasswordReset {
  token_hash    String @unique
  user_id       String
  email         String
  expires_at    DateTime  // 15 minutes
  used_at       DateTime?
  revoked_at    DateTime?
  ip_address    String
  user_agent    String
}
```

### Verify Reset Token

**Endpoint:** `POST /v1/oauth/password-reset/verify`

**Checks:**
- Token exists and not used
- Token not expired
- Token not revoked
- Email matches

### Confirm Password Reset

**Endpoint:** `POST /v1/oauth/password-reset/confirm`

**Security Measures:**
1. Verify reset token (same as verify endpoint)
2. Hash new password with Argon2
3. Update user password
4. Mark reset token as used
5. Revoke ALL existing refresh tokens (logout all devices)
6. Revoke ALL existing sessions (complete logout)
7. Log audit event

## Security Features

### 1. PKCE (Proof Key for Code Exchange)

**Implementation:**
- Mandatory S256 method (SHA256)
- Code verifier validation: `base64url(SHA256(code_verifier)) === code_challenge`
- Prevents authorization code interception attacks

### 2. Device Fingerprinting

**Components:**
- X-Device-Fingerprint header (if provided)
- IP address (from X-Forwarded-For or connection IP)
- User-Agent
- Hashed with pepper: `SHA256(fingerprint + PEPPER)`

**Validation:**
- Refresh token operations verify fingerprint matches session
- Mismatch triggers error: "Session mismatch"
- Provides protection against token theft

### 3. CSRF Protection

**Token Generation:**
- New CSRF token on each token exchange or refresh
- Token = `base64url(randomBytes(32))`
- Stored as hash: `SHA256(token + PEPPER)`
- Not HTTP-only (accessible to JavaScript)

**Validation:**
- Required header: `X-CSRF-Token`
- Value hashed and compared with session
- Using `timingSafeEqual()` to prevent timing attacks

### 4. Session Management

**Binding:**
- Session linked to user + device
- Contains device fingerprint hash
- Contains CSRF token hash
- Can be revoked independently

**Monitoring:**
- last_seen timestamp for activity tracking
- can_detect suspicious activity patterns

### 5. Password Security

**Hashing:**
- Algorithm: Argon2 (industry standard)
- Configuration: `argon2id` variant
- Salt: Cryptographically random (built into argon2)

**Reset Protection:**
- Tokens expire in 15 minutes
- Single-use enforcement
- IP address logged
- All sessions revoked on reset

### 6. Audit Logging

**Logged Events:**
- oauth_authorize (success/failure)
- oauth_token_exchange (success/failure)
- oauth_token_refresh (success/failure)
- oauth_revoke (success/failure)
- oauth_introspect (success/failure)
- oauth_register (success/failure)
- oauth_password_reset_request (success/failure)
- oauth_password_reset_verify (success/failure)
- oauth_password_reset (success/failure)

**Logged Information:**
- Action type
- Success/failure status
- Reason (if failed)
- User ID, organization ID, client ID
- IP address
- User-Agent
- Metadata (sensitive data excluded)
- Timestamp

**Security Measures:**
- Indexed by action and creation time for querying
- Indexed by user_id and client_id for forensics
- Cannot be modified (append-only)
- No sensitive data (passwords, tokens) stored

## Environment Configuration

```bash
# JWT Signing Keys (generate with: `ssh-keygen -t rsa -b 4096`)
OAUTH_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
OAUTH_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n..."

# Token Expiration
OAUTH_ACCESS_TOKEN_TTL_SEC=900          # 15 minutes
OAUTH_REFRESH_TOKEN_TTL_DAYS=30         # 30 days

# Security Peppers (generate with: `openssl rand -base64 32`)
OAUTH_CODE_PEPPER="random-base64-string"
OAUTH_REFRESH_TOKEN_PEPPER="random-base64-string"
OAUTH_CSRF_PEPPER="random-base64-string"
OAUTH_PASSWORD_RESET_PEPPER="random-base64-string"
OAUTH_FINGERPRINT_PEPPER="random-base64-string"

# Cookie Configuration
OAUTH_REFRESH_COOKIE_NAME=swayauth_rt
OAUTH_SESSION_COOKIE_NAME=swayauth_sid
OAUTH_CSRF_COOKIE_NAME=swayauth_csrf

# Frontend Configuration
FRONTEND_URL=https://example.com
```

## Database Migrations

```bash
# Generate migration
npx prisma migrate dev --name add_oauth_models

# Deploy to production
npx prisma migrate deploy

# Verify schema
npx prisma db push --skip-generate
```

## Error Handling (RFC 6749 Compliance)

All OAuth endpoints return error responses in RFC 6749 format:

```json
{
  "error": "error_code",
  "error_description": "Human-readable description",
  "error_uri": "https://example.com/docs/errors/error_code"
}
```

**Standard Error Codes:**

| Error Code | Status | Description |
|-----------|--------|-------------|
| invalid_request | 400 | Missing or invalid parameter |
| invalid_client | 400 | Unknown or invalid client_id |
| invalid_grant | 400 | Invalid authorization code or token |
| invalid_scope | 400 | Requested scope not granted |
| access_denied | 401 | User authentication failed |
| server_error | 500 | Server error (generic) |
| temporarily_unavailable | 503 | Service temporarily unavailable |
| interaction_required | 403 | Additional interaction needed (e.g., 2FA) |
| unsupported_grant_type | 400 | Unsupported grant type |

## Testing

### Unit Tests

```bash
# Run unit tests
npm test src/oauth/oauth.service.spec.ts
npm test src/oauth/oauth.controller.spec.ts

# With coverage
npm test src/oauth -- --coverage
```

### Integration Tests

```bash
# Run integration tests
npm run test:e2e test/oauth.e2e-spec.ts
```

### Manual Testing

**Generate Code Verifier:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

**Generate Code Challenge:**
```bash
node -e "
const cv = process.argv[1];
const crypto = require('crypto');
const cc = crypto.createHash('sha256').update(cv).digest('base64url');
console.log(cc);
"
```

**Test Authorization Code Flow:**
```bash
# 1. Request authorization code
curl -X POST http://localhost:8000/v1/oauth/authorize \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "org-token-1",
    "redirect_uri": "https://example.com/callback",
    "code_challenge": "E9Mrozoa2owWoUgT60SVlcul_Z2umRmFkBMMXV5EN5s",
    "email": "test@example.com",
    "password": "password123"
  }'

# 2. Exchange code for tokens
curl -X POST http://localhost:8000/v1/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "client_id": "org-token-1",
    "redirect_uri": "https://example.com/callback",
    "code": "returned-code",
    "code_verifier": "code-verifier-value"
  }'
```

## Deployment Checklist

- [ ] Generate RSA key pair (4096-bit minimum)
- [ ] Generate random peppers for all hashing operations
- [ ] Store secrets in secure vault (AWS Secrets Manager, HashiCorp Vault)
- [ ] Enable HTTPS for all endpoints
- [ ] Configure CORS for allowed origins
- [ ] Set secure cookie flags (Secure, SameSite, HttpOnly)
- [ ] Enable rate limiting on auth endpoints
- [ ] Configure audit log retention policy
- [ ] Set up monitoring for failed auth attempts
- [ ] Enable two-factor authentication enforcement
- [ ] Test password reset flow end-to-end
- [ ] Load test token endpoint
- [ ] Verify audit logging completeness
- [ ] Document org-specific constraints
- [ ] Set up alerts for security events

## Performance Optimization

**Database Indexes:**
```sql
-- Already created in schema
CREATE INDEX oauth_session_user_client ON oauth_sessions(client_id, user_id);
CREATE INDEX oauth_authcode_user_client ON oauth_authorization_codes(client_id, user_id);
CREATE INDEX oauth_refresh_user_client ON oauth_refresh_tokens(client_id, user_id, session_id);
CREATE INDEX oauth_revoked_exp ON oauth_revoked_access_tokens(exp);
CREATE INDEX oauth_audit_action_created ON oauth_audit_logs(action, created_at);
CREATE INDEX oauth_audit_user_client ON oauth_audit_logs(client_id, user_id);
CREATE INDEX password_reset_email_exp ON password_resets(email, expires_at);
```

**Caching Strategies:**
- Cache public keys (RS256) for token verification (5-minute TTL)
- Cache organization tokens (10-minute TTL)
- Use Redis for session storage (optional)
- Implement DB connection pooling

## Monitoring & Alerting

**Metrics to Track:**
- Authorization code exchange success rate
- Token refresh success rate
- Token revocation rate
- Failed login attempts per user
- Failed password reset attempts
- Average token generation time

**Alerts to Configure:**
- High rate of failed login attempts (> 5 in 15 minutes)
- Multiple password reset attempts (> 3 in 1 hour)
- Unusual geographic patterns
- High error rate on auth endpoints
- Database connection pool exhaustion

## Compliance

**Standards Implemented:**
- OAuth 2.0 (RFC 6749)
- PKCE (RFC 7636)
- Token Revocation (RFC 7009)
- Token Introspection (RFC 7662)
- JWT (RFC 7519)

**Security Considerations:**
- GDPR: User data retention, data deletion, audit logs
- SOC 2: Audit logging, access control, encryption
- PCI DSS: Password hashing, secure transmission
- NIST: Cryptographic algorithms, random number generation

## Troubleshooting

**Common Issues & Solutions:**

1. **Invalid PKCE Challenge**
   - Verify code_verifier is URL-safe base64
   - Verify code_challenge is SHA256 of verifier
   - Check code_challenge_method is S256

2. **Session Mismatch Error**
   - Verify device fingerprint header or IP matches
   - Ensure X-Device-Fingerprint or IP is consistent
   - Check for proxy/VPN changing IP

3. **CSRF Token Validation Failed**
   - Verify X-CSRF-Token header is present
   - Verify token matches session CSRF hash
   - Check for stale tokens (refresh session)

4. **Refresh Token Expired**
   - Check OAUTH_REFRESH_TOKEN_TTL_DAYS setting
   - Verify server time is synchronized
   - Check for token revocation

## Support & Documentation

- **API Documentation:** https://api.swayauth.com/docs
- **OpenAPI Spec:** See OAUTH_API_SPEC.yaml
- **Issues & Security Reports:** security@swayauth.com
