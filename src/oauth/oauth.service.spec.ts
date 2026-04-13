import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { OAuthService } from './oauth.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import argon from 'argon2';
import crypto from 'crypto';

describe('OAuthService', () => {
  let service: OAuthService;
  let prismaService: any;
  let jwtService: JwtService;
  let mailService: any;

  const mockOrganizationToken = {
    id: 'org-token-1',
    name: 'Test Org Token',
    api_key: 'test-key',
    redirect_url: 'https://example.com/callback',
    origins: ['https://example.com'],
    organization_id: 'org-1',
    company_id: 'company-1',
    organization: { id: 'org-1', name: 'Test Org' },
    company: { id: 'company-1', name: 'Test Company', status: 'active' },
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    password: '$argon2id$v=19$m=19456,t=2,p=1$...',
    organization_id: 'org-1',
    company_id: 'company-1',
    first_name: 'Test',
    last_name: 'User',
    status: 'active',
    verified: true,
    scope: [],
    permissions: [],
    access: 'level_1',
    company: { id: 'company-1', status: 'active' },
  };

  const mockRequest = {
    headers: {
      'x-forwarded-for': '192.168.1.1',
      'user-agent': 'Mozilla/5.0',
    },
    ip: '192.168.1.1',
  } as any;

  beforeAll(() => {
    process.env.OAUTH_CODE_PEPPER = 'code-pepper';
    process.env.OAUTH_REFRESH_TOKEN_PEPPER = 'refresh-pepper';
    process.env.OAUTH_PASSWORD_RESET_PEPPER = 'reset-pepper';
    process.env.OAUTH_CSRF_PEPPER = 'csrf-pepper';
    process.env.OAUTH_FINGERPRINT_PEPPER = 'fingerprint-pepper';
    process.env.OAUTH_PRIVATE_KEY = 'test-private-key';
    process.env.FRONTEND_URL = 'https://app.example.com';
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthService,
        {
          provide: PrismaService,
          useValue: {
            organizationToken: {
              findFirst: jest.fn(),
            },
            user: {
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            oAuthAuthorizationCode: {
              create: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            oAuthSession: {
              create: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            oAuthRefreshToken: {
              create: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            oAuthAuditLog: {
              create: jest.fn(),
            },
            oAuthRevokedAccessToken: {
              upsert: jest.fn(),
              findFirst: jest.fn(),
            },
            passwordReset: {
              create: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendPasswordReset: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OAuthService>(OAuthService);
    prismaService = module.get<any>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    mailService = module.get<any>(MailService);
  });

  describe('Authorization Code Flow', () => {
    it('should generate authorization code with PKCE', async () => {
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

      jest
        .spyOn(prismaService.organizationToken, 'findFirst')
        .mockResolvedValue(mockOrganizationToken as any);
      jest
        .spyOn(prismaService.user, 'findFirst')
        .mockResolvedValue(mockUser as any);
      jest
        .spyOn(prismaService.oAuthAuthorizationCode, 'create')
        .mockResolvedValue({ id: 'code-1' } as any);

      jest.spyOn(argon, 'verify').mockResolvedValue(true);

      const result = (await service.authorize({
        client_id: 'org-token-1',
        redirect_uri: 'https://example.com/callback',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state: 'state123',
        scope: 'read write',
        email: 'test@example.com',
        password: 'password123',
        req: mockRequest,
      })) as any;

      expect(result).not.toHaveProperty('error');
      expect(result).toHaveProperty('code');
      expect(result.state).toBe('state123');
    });

    it('should reject invalid redirect_uri', async () => {
      jest
        .spyOn(prismaService.organizationToken, 'findFirst')
        .mockResolvedValue(mockOrganizationToken as any);

      const result = (await service.authorize({
        client_id: 'org-token-1',
        redirect_uri: 'https://malicious.com/callback',
        code_challenge: 'challenge',
        email: 'test@example.com',
        password: 'password123',
        req: mockRequest,
      })) as any;

      expect(result.error).toBe('invalid_request');
    });

    it('should reject invalid credentials', async () => {
      jest
        .spyOn(prismaService.organizationToken, 'findFirst')
        .mockResolvedValue(mockOrganizationToken as any);
      jest
        .spyOn(prismaService.user, 'findFirst')
        .mockResolvedValue(null);

      const result = (await service.authorize({
        client_id: 'org-token-1',
        redirect_uri: 'https://example.com/callback',
        code_challenge: 'challenge',
        email: 'nonexistent@example.com',
        password: 'password123',
        req: mockRequest,
      })) as any;

      expect(result.error).toBe('access_denied');
    });
  });

  describe('Token Exchange', () => {
    it('should exchange authorization code for tokens', async () => {
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

      const mockAuthCode = {
        id: 'code-1',
        code_hash: 'hash',
        client_id: 'org-token-1',
        redirect_uri: 'https://example.com/callback',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        user_id: 'user-1',
        organization_id: 'org-1',
        organization_token_id: 'org-token-1',
        company_id: 'company-1',
        scope: ['read', 'write'],
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
        used_at: null,
        revoked_at: null,
      };

      jest
        .spyOn(prismaService.organizationToken, 'findFirst')
        .mockResolvedValue(mockOrganizationToken as any);
      jest
        .spyOn(prismaService.oAuthAuthorizationCode, 'findFirst')
        .mockResolvedValue(mockAuthCode as any);
      jest
        .spyOn(prismaService.oAuthAuthorizationCode, 'update')
        .mockResolvedValue({} as any);
      jest
        .spyOn(prismaService.user, 'findFirst')
        .mockResolvedValue(mockUser as any);
      jest
        .spyOn(prismaService.oAuthSession, 'create')
        .mockResolvedValue({ id: 'session-1' } as any);
      jest
        .spyOn(prismaService.oAuthRefreshToken, 'create')
        .mockResolvedValue({} as any);
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue('access-token');

      const result = (await service.token(
        {
          grant_type: 'authorization_code' as any,
          client_id: 'org-token-1',
          redirect_uri: 'https://example.com/callback',
          code: 'auth-code',
          code_verifier: codeVerifier,
        },
        mockRequest,
      )) as any;

      expect(result).toHaveProperty('response');
      expect(result.response).toHaveProperty('access_token');
      expect(result.response).toHaveProperty('token_type', 'Bearer');
    });

    it('should reject expired authorization code', async () => {
      const expiredAuthCode = {
        id: 'code-1',
        code_hash: 'hash',
        client_id: 'org-token-1',
        redirect_uri: 'https://example.com/callback',
        expires_at: new Date(Date.now() - 1000), // Expired
      };

      jest
        .spyOn(prismaService.organizationToken, 'findFirst')
        .mockResolvedValue(mockOrganizationToken as any);
      jest
        .spyOn(prismaService.oAuthAuthorizationCode, 'findFirst')
        .mockResolvedValue(expiredAuthCode as any);

      const result = (await service.token(
        {
          grant_type: 'authorization_code' as any,
          client_id: 'org-token-1',
          redirect_uri: 'https://example.com/callback',
          code: 'auth-code',
          code_verifier: 'verifier',
        },
        mockRequest,
      )) as any;

      expect(result.error).toBe('invalid_grant');
    });
  });

  describe('Token Refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const csrfHash = crypto
        .createHash('sha256')
        .update(`csrf-token.${process.env.OAUTH_CSRF_PEPPER}`)
        .digest('hex');

      const mockSession = {
        id: 'session-1',
        csrf_token_hash: csrfHash,
        device_fingerprint_hash: service['getDeviceFingerprintHash'](mockRequest),
        revoked_at: null,
      };

      const mockRefresh = {
        id: 'refresh-1',
        token_hash: 'refresh-hash',
        client_id: 'org-token-1',
        session_id: 'session-1',
        user_id: 'user-1',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        revoked_at: null,
        session: mockSession,
      };

      jest
        .spyOn(prismaService.oAuthRefreshToken, 'findFirst')
        .mockResolvedValue(mockRefresh as any);
      jest
        .spyOn(prismaService.oAuthRefreshToken, 'update')
        .mockResolvedValue({} as any);
      jest
        .spyOn(prismaService.oAuthSession, 'update')
        .mockResolvedValue({} as any);
      jest
        .spyOn(prismaService.oAuthRefreshToken, 'create')
        .mockResolvedValue({} as any);
      jest
        .spyOn(prismaService.user, 'findFirst')
        .mockResolvedValue(mockUser as any);
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue('new-access-token');

      const mockRequestWithCSRF = {
        ...mockRequest,
        headers: {
          ...mockRequest.headers,
          'x-csrf-token': 'csrf-token',
        },
      };

      const result = (await service.token(
        {
          grant_type: 'refresh_token' as any,
          client_id: 'org-token-1',
          refresh_token: 'refresh-token',
        },
        mockRequestWithCSRF,
      )) as any;

      expect(result.response).toHaveProperty('access_token');
    });

    it('should reject expired refresh token', async () => {
      const expiredRefresh = {
        id: 'refresh-1',
        token_hash: 'refresh-hash',
        client_id: 'org-token-1',
        expires_at: new Date(Date.now() - 1000),
        revoked_at: null,
      };

      jest
        .spyOn(prismaService.oAuthRefreshToken, 'findFirst')
        .mockResolvedValue(expiredRefresh as any);

      const result = (await service.token(
        {
          grant_type: 'refresh_token' as any,
          client_id: 'org-token-1',
          refresh_token: 'refresh-token',
        },
        mockRequest,
      )) as any;

      expect(result.error).toBe('invalid_grant');
    });
  });

  describe('Token Revocation', () => {
    it('should revoke refresh token', async () => {
      const mockRefresh = {
        id: 'refresh-1',
        session_id: 'session-1',
        user_id: 'user-1',
        client_id: 'org-token-1',
      };

      jest
        .spyOn(prismaService.oAuthRefreshToken, 'findFirst')
        .mockResolvedValue(mockRefresh as any);
      jest
        .spyOn(prismaService.oAuthRefreshToken, 'update')
        .mockResolvedValue({} as any);
      jest
        .spyOn(prismaService.oAuthSession, 'update')
        .mockResolvedValue({} as any);

      await service.revoke({
        client_id: 'org-token-1',
        token: 'refresh-token',
        token_type_hint: 'refresh_token',
        req: mockRequest,
      });

      expect(prismaService.oAuthRefreshToken.update).toHaveBeenCalled();
      expect(prismaService.oAuthSession.update).toHaveBeenCalled();
    });

    it('should revoke access token via JTI', async () => {
      const mockPayload = {
        sub: 'user-1',
        jti: 'jti-123',
        exp: Math.floor(Date.now() / 1000) + 3600,
        aud: 'org-token-1',
      };

      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockResolvedValue(mockPayload);
      jest
        .spyOn(prismaService.oAuthRevokedAccessToken, 'upsert')
        .mockResolvedValue({} as any);

      await service.revoke({
        client_id: 'org-token-1',
        token: 'access-token',
        token_type_hint: 'access_token',
        req: mockRequest,
      });

      expect(prismaService.oAuthRevokedAccessToken.upsert).toHaveBeenCalled();
    });
  });

  describe('Token Introspection', () => {
    it('should introspect valid access token', async () => {
      const mockPayload = {
        sub: 'user-1',
        email: 'test@example.com',
        scope: ['read', 'write'],
        aud: 'org-token-1',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        jti: 'jti-123',
      };

      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockResolvedValue(mockPayload);
      jest
        .spyOn(prismaService.oAuthRevokedAccessToken, 'findFirst')
        .mockResolvedValue(null);

      const result = await service.introspect({
        token: 'access-token',
        req: mockRequest,
      });

      expect(result.active).toBe(true);
      expect(result.sub).toBe('user-1');
      expect(result.username).toBe('test@example.com');
    });

    it('should mark revoked token as inactive', async () => {
      const mockPayload = {
        sub: 'user-1',
        jti: 'jti-123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockResolvedValue(mockPayload);
      jest
        .spyOn(prismaService.oAuthRevokedAccessToken, 'findFirst')
        .mockResolvedValue({} as any);

      const result = await service.introspect({
        token: 'access-token',
        req: mockRequest,
      });

      expect(result.active).toBe(false);
    });

    it('should return inactive for expired token', async () => {
      const mockPayload = {
        sub: 'user-1',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired
      };

      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockResolvedValue(mockPayload);

      const result = await service.introspect({
        token: 'access-token',
        req: mockRequest,
      });

      expect(result.active).toBe(false);
    });
  });

  describe('Password Reset', () => {
    it('should request password reset', async () => {
      jest
        .spyOn(prismaService.organizationToken, 'findFirst')
        .mockResolvedValue(mockOrganizationToken as any);
      jest
        .spyOn(prismaService.user, 'findFirst')
        .mockResolvedValue(mockUser as any);
      jest
        .spyOn(prismaService.passwordReset, 'create')
        .mockResolvedValue({} as any);
      jest.spyOn(mailService, 'sendPasswordReset').mockResolvedValue(undefined);

      const result = (await service.requestPasswordReset({
        email: 'test@example.com',
        client_id: 'org-token-1',
        req: mockRequest,
      })) as any;

      expect(result.success).toBe(true);
      expect(mailService.sendPasswordReset).toHaveBeenCalled();
    });

    it('should verify password reset token', async () => {
      const mockReset = {
        id: 'reset-1',
        token_hash: 'hash',
        email: 'test@example.com',
        user_id: 'user-1',
        expires_at: new Date(Date.now() + 15 * 60 * 1000),
        used_at: null,
        revoked_at: null,
      };

      jest
        .spyOn(prismaService.organizationToken, 'findFirst')
        .mockResolvedValue(mockOrganizationToken as any);
      jest
        .spyOn(prismaService.passwordReset, 'findFirst')
        .mockResolvedValue(mockReset as any);

      const result = (await service.verifyPasswordResetToken({
        email: 'test@example.com',
        reset_token: 'reset-token',
        client_id: 'org-token-1',
        req: mockRequest,
      })) as any;

      expect(result.valid).toBe(true);
    });

    it('should reset password with valid token', async () => {
      const mockReset = {
        id: 'reset-1',
        token_hash: 'hash',
        email: 'test@example.com',
        user_id: 'user-1',
        expires_at: new Date(Date.now() + 15 * 60 * 1000),
        used_at: null,
        revoked_at: null,
      };

      jest
        .spyOn(prismaService.organizationToken, 'findFirst')
        .mockResolvedValue(mockOrganizationToken as any);
      jest
        .spyOn(prismaService.passwordReset, 'findFirst')
        .mockResolvedValue(mockReset as any);
      jest
        .spyOn(prismaService.user, 'update')
        .mockResolvedValue({} as any);
      jest
        .spyOn(prismaService.passwordReset, 'update')
        .mockResolvedValue({} as any);
      jest
        .spyOn(prismaService.oAuthRefreshToken, 'updateMany')
        .mockResolvedValue({} as any);
      jest
        .spyOn(prismaService.oAuthSession, 'updateMany')
        .mockResolvedValue({} as any);

      const result = (await service.resetPassword({
        email: 'test@example.com',
        new_password: 'newPassword123',
        reset_token: 'reset-token',
        client_id: 'org-token-1',
        req: mockRequest,
      })) as any;

      expect(result.success).toBe(true);
      expect(prismaService.user.update).toHaveBeenCalled();
    });

    it('should reject expired reset token', async () => {
      const expiredReset = {
        id: 'reset-1',
        token_hash: 'hash',
        expires_at: new Date(Date.now() - 1000),
      };

      jest
        .spyOn(prismaService.organizationToken, 'findFirst')
        .mockResolvedValue(mockOrganizationToken as any);
      jest
        .spyOn(prismaService.passwordReset, 'findFirst')
        .mockResolvedValue(expiredReset as any);

      const result = await service.resetPassword({
        email: 'test@example.com',
        new_password: 'newPassword123',
        reset_token: 'reset-token',
        client_id: 'org-token-1',
        req: mockRequest,
      });

      expect('error' in result).toBe(true);
      expect((result as any).error).toBe('invalid_grant');
    });
  });

  describe('User Registration', () => {
    it('should register new user', async () => {
      jest
        .spyOn(prismaService.organizationToken, 'findFirst')
        .mockResolvedValue(mockOrganizationToken as any);
      jest
        .spyOn(prismaService.user, 'findFirst')
        .mockResolvedValue(null);
      jest
        .spyOn(prismaService.user, 'create')
        .mockResolvedValue({ id: 'user-1' } as any);

      const result = await service.register({
        email: 'newuser@example.com',
        password: 'password123',
        first_name: 'New',
        last_name: 'User',
        client_id: 'org-token-1',
        req: mockRequest,
      });

      expect('error' in result).toBe(false);
      expect((result as any).success).toBe(true);
      expect((result as any).user_id).toBe('user-1');
    });

    it('should reject duplicate user registration', async () => {
      jest
        .spyOn(prismaService.organizationToken, 'findFirst')
        .mockResolvedValue(mockOrganizationToken as any);
      jest
        .spyOn(prismaService.user, 'findFirst')
        .mockResolvedValue(mockUser as any);

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
        client_id: 'org-token-1',
        req: mockRequest,
      });

      expect('error' in result).toBe(true);
      expect((result as any).error).toBe('invalid_request');
      expect((result as any).status).toBe(409);
    });
  });

  describe('Audit Logging', () => {
    it('should audit successful authentication', async () => {
      jest
        .spyOn(prismaService.oAuthAuditLog, 'create')
        .mockResolvedValue({} as any);

      await service['audit']({
        action: 'oauth_authorize',
        success: true,
        client_id: 'org-token-1',
        user_id: 'user-1',
        req: mockRequest,
      });

      expect(prismaService.oAuthAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'oauth_authorize',
          success: true,
          client_id: 'org-token-1',
          user_id: 'user-1',
        }),
      });
    });
  });
});
