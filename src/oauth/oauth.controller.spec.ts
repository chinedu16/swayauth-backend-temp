import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';

describe('OAuthController', () => {
  let controller: OAuthController;
  let service: OAuthService;

  const mockRequest = {
    headers: {
      'x-forwarded-for': '192.168.1.1',
      'user-agent': 'Mozilla/5.0',
    },
    cookies: {},
  } as any;

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({ throttlers: [{ limit: 10, ttl: 60 }] }),
      ],
      controllers: [OAuthController],
      providers: [
        {
          provide: OAuthService,
          useValue: {
            authorize: jest.fn(),
            token: jest.fn(),
            revoke: jest.fn(),
            introspect: jest.fn(),
            register: jest.fn(),
            requestPasswordReset: jest.fn(),
            verifyPasswordResetToken: jest.fn(),
            resetPassword: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<OAuthController>(OAuthController);
    service = module.get<OAuthService>(OAuthService);
  });

  describe('authorize', () => {
    it('should redirect with authorization code on success', async () => {
      jest.spyOn(service, 'authorize').mockResolvedValue({
        code: 'auth-code-123',
        state: 'state-123',
        redirect_uri: 'https://example.com/callback',
      });

      await controller.authorize(
        {
          client_id: 'client-1',
          redirect_uri: 'https://example.com/callback',
          code_challenge: 'challenge',
          state: 'state-123',
          email: 'test@example.com',
          password: 'password123',
        },
        mockRequest,
        mockResponse,
      );

      expect(mockResponse.redirect).toHaveBeenCalled();
    });

    it('should redirect with error on invalid client', async () => {
      jest.spyOn(service, 'authorize').mockResolvedValue({
        status: 400,
        error: 'invalid_client',
        error_description: 'Unknown client_id',
      });

      await controller.authorize(
        {
          client_id: 'invalid-client',
          redirect_uri: 'https://example.com/callback',
          code_challenge: 'challenge',
          email: 'test@example.com',
          password: 'password123',
        },
        mockRequest,
        mockResponse,
      );

      expect(mockResponse.redirect).toHaveBeenCalled();
    });
  });

  describe('token', () => {
    it('should exchange authorization code for tokens', async () => {
      jest.spyOn(service, 'token').mockResolvedValue({
        response: {
          access_token: 'access-token',
          token_type: 'Bearer',
          expires_in: 900,
        },
        refresh_token: 'refresh-token',
        csrf_token: 'csrf-token',
        session_id: 'session-1',
      });

      await controller.token(
        {
          grant_type: 'authorization_code' as any,
          client_id: 'client-1',
          redirect_uri: 'https://example.com/callback',
          code: 'auth-code',
          code_verifier: 'verifier',
        },
        mockRequest,
        mockResponse,
      );

      expect(mockResponse.cookie).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          access_token: 'access-token',
        }),
      );
    });

    it('should refresh access token', async () => {
      jest.spyOn(service, 'token').mockResolvedValue({
        response: {
          access_token: 'new-access-token',
          token_type: 'Bearer',
          expires_in: 900,
        },
        refresh_token: 'new-refresh-token',
        csrf_token: 'new-csrf-token',
        session_id: 'session-1',
      });

      mockRequest.cookies['swayauth_rt'] = 'old-refresh-token';

      await controller.token(
        {
          grant_type: 'refresh_token' as any,
          client_id: 'client-1',
        },
        mockRequest,
        mockResponse,
      );

      expect(mockResponse.cookie).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should return error for invalid grant', async () => {
      jest.spyOn(service, 'token').mockResolvedValue({
        status: 400,
        error: 'invalid_grant',
        error_description: 'Invalid or expired code',
      });

      await controller.token(
        {
          grant_type: 'authorization_code' as any,
          client_id: 'client-1',
          redirect_uri: 'https://example.com/callback',
          code: 'invalid-code',
          code_verifier: 'verifier',
        },
        mockRequest,
        mockResponse,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'invalid_grant',
        }),
      );
    });
  });

  describe('revoke', () => {
    it('should revoke token and clear cookies', async () => {
      jest.spyOn(service, 'revoke').mockResolvedValue({ status: 200 } as any);

      await controller.revoke(
        {
          token: 'refresh-token',
          token_type_hint: 'refresh_token',
        },
        mockRequest,
        mockResponse,
      );

      expect(mockResponse.clearCookie).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });

  describe('introspect', () => {
    it('should return active token info', async () => {
      jest.spyOn(service, 'introspect').mockResolvedValue({
        active: true,
        scope: 'read write',
        client_id: 'client-1',
        username: 'test@example.com',
        sub: 'user-1',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });

      await controller.introspect(
        { token: 'access-token' },
        mockRequest,
        mockResponse,
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          active: true,
        }),
      );
    });

    it('should return inactive for revoked token', async () => {
      jest.spyOn(service, 'introspect').mockResolvedValue({
        active: false,
      });

      await controller.introspect(
        { token: 'revoked-token' },
        mockRequest,
        mockResponse,
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          active: false,
        }),
      );
    });
  });

  describe('register', () => {
    it('should create new user', async () => {
      jest.spyOn(service, 'register').mockResolvedValue({
        success: true,
        user_id: 'user-1',
      });

      await controller.register(
        {
          email: 'newuser@example.com',
          password: 'password123',
          first_name: 'John',
          last_name: 'Doe',
          client_id: 'client-1',
        },
        mockRequest,
        mockResponse,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should reject duplicate user', async () => {
      jest.spyOn(service, 'register').mockResolvedValue({
        status: 409,
        error: 'invalid_request',
        error_description: 'User already exists',
      });

      await controller.register(
        {
          email: 'existing@example.com',
          password: 'password123',
          client_id: 'client-1',
        },
        mockRequest,
        mockResponse,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(409);
    });
  });

  describe('requestPasswordReset', () => {
    it('should request password reset', async () => {
      jest.spyOn(service, 'requestPasswordReset').mockResolvedValue({
        success: true,
      });

      await controller.requestPasswordReset(
        {
          email: 'test@example.com',
          client_id: 'client-1',
        },
        mockRequest,
        mockResponse,
      );

      expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('verifyPasswordResetToken', () => {
    it('should verify reset token', async () => {
      jest.spyOn(service, 'verifyPasswordResetToken').mockResolvedValue({
        valid: true,
      });

      await controller.verifyPasswordResetToken(
        {
          email: 'test@example.com',
          reset_token: 'reset-token',
          client_id: 'client-1',
        },
        mockRequest,
        mockResponse,
      );

      expect(mockResponse.json).toHaveBeenCalledWith({ valid: true });
    });

    it('should return invalid for expired token', async () => {
      jest.spyOn(service, 'verifyPasswordResetToken').mockResolvedValue({
        valid: false,
        error: 'invalid_token',
      });

      await controller.verifyPasswordResetToken(
        {
          email: 'test@example.com',
          reset_token: 'expired-token',
          client_id: 'client-1',
        },
        mockRequest,
        mockResponse,
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          valid: false,
        }),
      );
    });
  });

  describe('resetPassword', () => {
    it('should reset password', async () => {
      jest.spyOn(service, 'resetPassword').mockResolvedValue({
        success: true,
      });

      await controller.resetPassword(
        {
          email: 'test@example.com',
          new_password: 'newPassword123',
          reset_token: 'reset-token',
          client_id: 'client-1',
        },
        mockRequest,
        mockResponse,
      );

      expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
    });

    it('should reject invalid token', async () => {
      jest.spyOn(service, 'resetPassword').mockResolvedValue({
        status: 400,
        error: 'invalid_grant',
        error_description: 'Invalid or expired reset token',
      });

      await controller.resetPassword(
        {
          email: 'test@example.com',
          new_password: 'newPassword123',
          reset_token: 'invalid-token',
          client_id: 'client-1',
        },
        mockRequest,
        mockResponse,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });
});
