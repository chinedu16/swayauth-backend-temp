import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OrganizationToken, User } from '@prisma/client';
import argon from 'argon2';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { verifyUserAuthorization } from '../common/util/common';
import { OAuthGrantType, OAuthTokenDto } from './dto/oauth.dto';
import crypto from 'crypto';
import { MailService } from '../mail/mail.service';
import { SmsService } from '../sms/sms.service';
import {
  Decrypt,
  createReference,
  expireIn,
  gen6digit,
} from '../common';

type OAuthError = {
  status: number;
  error: string;
  error_description?: string;
};

type TokenResponse = {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope?: string;
};

@Injectable()
export class OAuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
    private sms: SmsService,
  ) {}

  private now() {
    return new Date();
  }

  private base64url(bytes: Buffer) {
    return bytes.toString('base64url');
  }

  private sha256Base64url(value: string) {
    return this.base64url(crypto.createHash('sha256').update(value).digest());
  }

  private sha256Hex(value: string) {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private requireEnv(name: string) {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Missing env: ${name}`);
    }
    return value;
  }

  private getCodeHash(code: string) {
    return this.sha256Hex(`${code}.${this.requireEnv('OAUTH_CODE_PEPPER')}`);
  }

  private getRefreshTokenHash(token: string) {
    return this.sha256Hex(
      `${token}.${this.requireEnv('OAUTH_REFRESH_TOKEN_PEPPER')}`,
    );
  }

  private getDeviceFingerprintHash(req: Request) {
    const header = (req.headers['x-device-fingerprint'] as string | undefined)
      ?.trim()
      .slice(0, 512);
    const ip = (req.headers['x-forwarded-for'] as string | undefined)
      ?.split(',')[0]
      ?.trim();
    const userAgent = (req.headers['user-agent'] as string | undefined)
      ?.trim()
      .slice(0, 512);
    const raw = header || `${ip || ''}.${userAgent || ''}`;
    return this.sha256Hex(
      `${raw}.${this.requireEnv('OAUTH_FINGERPRINT_PEPPER')}`,
    );
  }

  private getIp(req: Request) {
    return (
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ||
      (req.ip as string | undefined) ||
      null
    );
  }

  private getUserAgent(req: Request) {
    return (req.headers['user-agent'] as string | undefined)?.trim() || null;
  }

  private parseScope(scope: string | undefined) {
    const raw = (scope || '').trim();
    if (!raw) return [];
    return raw
      .split(' ')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
  }

  private validateRedirectUri(token: OrganizationToken, redirectUri: string) {
    if (token.redirect_url) {
      if (token.redirect_url !== redirectUri) {
        return false;
      }
      return true;
    }
    try {
      const origin = new URL(redirectUri).origin;
      return token.origins.includes(origin);
    } catch {
      return false;
    }
  }

  private async signAccessToken(user: User, clientId: string) {
    const privateKey = this.requireEnv('OAUTH_PRIVATE_KEY');
    const expiresInSeconds = Number(
      process.env.OAUTH_ACCESS_TOKEN_TTL_SEC || 900,
    );
    const jti = crypto.randomUUID();
    const payload = {
      sub: user.id,
      email: user.email,
      scope: user.scope,
      permissions: user.permissions,
      status: user.status,
      company_id: user.company_id,
      organization_token_id: user.organization_token_id,
      organization_id: user.organization_id,
      access: user.access,
      jti,
      aud: clientId,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      algorithm: 'RS256',
      expiresIn: expiresInSeconds,
      privateKey,
    });
    return { accessToken, expiresInSeconds, jti };
  }

  private oauthError(status: number, error: string, description?: string) {
    const res: OAuthError = { status, error };
    if (description) res.error_description = description;
    return res;
  }

  async authorize(params: {
    client_id: string;
    redirect_uri: string;
    code_challenge: string;
    code_challenge_method?: string;
    state?: string;
    scope?: string;
    email: string;
    password: string;
    req: Request;
  }) {
    const token = await this.prisma.organizationToken.findFirst({
      where: { id: params.client_id },
    });
    if (!token) {
      return this.oauthError(400, 'invalid_client', 'Unknown client_id');
    }
    if (!this.validateRedirectUri(token, params.redirect_uri)) {
      return this.oauthError(400, 'invalid_request', 'Invalid redirect_uri');
    }
    const method = (params.code_challenge_method || 'S256').toUpperCase();
    if (method !== 'S256') {
      return this.oauthError(
        400,
        'invalid_request',
        'Unsupported code_challenge_method',
      );
    }

    const user = await this.prisma.user.findFirst({
      where: {
        email: params.email,
        organization_id: token.organization_id,
        status: 'active',
      },
      include: {
        company: true,
      },
    });
    if (!user || !user.company) {
      await this.audit({
        action: 'oauth_authorize',
        success: false,
        reason: 'user_not_found',
        client_id: token.id,
        organization_id: token.organization_id,
        organization_token_id: token.id,
        company_id: token.company_id,
        req: params.req,
      });
      return this.oauthError(401, 'access_denied', 'Invalid credentials');
    }

    try {
      await verifyUserAuthorization(user as any);
    } catch {
      await this.audit({
        action: 'oauth_authorize',
        success: false,
        reason: 'user_not_authorized',
        client_id: token.id,
        user_id: user.id,
        organization_id: user.organization_id,
        organization_token_id: token.id,
        company_id: user.company_id,
        req: params.req,
      });
      return this.oauthError(403, 'access_denied', 'User not authorized');
    }

    if (!user.password) {
      return this.oauthError(
        403,
        'access_denied',
        'Manual login not available',
      );
    }

    const ok = await argon.verify(user.password, params.password);
    if (!ok) {
      await this.audit({
        action: 'oauth_authorize',
        success: false,
        reason: 'invalid_password',
        client_id: token.id,
        user_id: user.id,
        organization_id: user.organization_id,
        organization_token_id: token.id,
        company_id: user.company_id,
        req: params.req,
      });
      return this.oauthError(401, 'access_denied', 'Invalid credentials');
    }

    if (user.scope.includes('two_factor') && user.two_factor_type) {
      await this.audit({
        action: 'oauth_authorize',
        success: false,
        reason: 'two_factor_required',
        client_id: token.id,
        user_id: user.id,
        organization_id: user.organization_id,
        organization_token_id: token.id,
        company_id: user.company_id,
        req: params.req,
      });
      return this.oauthError(
        403,
        'interaction_required',
        'Two-factor required',
      );
    }

    const code = this.base64url(crypto.randomBytes(32));
    const codeHash = this.getCodeHash(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.oAuthAuthorizationCode.create({
      data: {
        code_hash: codeHash,
        client_id: token.id,
        redirect_uri: params.redirect_uri,
        scope: this.parseScope(params.scope),
        code_challenge: params.code_challenge,
        code_challenge_method: method,
        user_id: user.id,
        organization_id: user.organization_id,
        organization_token_id: token.id,
        company_id: user.company_id,
        expires_at: expiresAt,
        ip_address: this.getIp(params.req),
        user_agent: this.getUserAgent(params.req),
      },
    });

    await this.audit({
      action: 'oauth_authorize',
      success: true,
      client_id: token.id,
      user_id: user.id,
      organization_id: user.organization_id,
      organization_token_id: token.id,
      company_id: user.company_id,
      req: params.req,
    });

    return {
      code,
      state: params.state || null,
      redirect_uri: params.redirect_uri,
    };
  }

  private verifyPkce(codeVerifier: string, codeChallenge: string) {
    const computed = this.sha256Base64url(codeVerifier);
    return crypto.timingSafeEqual(
      Buffer.from(computed),
      Buffer.from(codeChallenge),
    );
  }

  async token(dto: OAuthTokenDto, req: Request) {
    if (dto.grant_type === OAuthGrantType.authorization_code) {
      return await this.exchangeAuthorizationCode(dto, req);
    }
    if (dto.grant_type === OAuthGrantType.refresh_token) {
      return await this.refreshAccessToken(dto, req);
    }
    return this.oauthError(
      400,
      'unsupported_grant_type',
      'Unsupported grant_type',
    );
  }

  private async exchangeAuthorizationCode(dto: OAuthTokenDto, req: Request) {
    if (!dto.code || !dto.redirect_uri || !dto.code_verifier) {
      return this.oauthError(
        400,
        'invalid_request',
        'Missing required parameters',
      );
    }
    const token = await this.prisma.organizationToken.findFirst({
      where: { id: dto.client_id },
    });
    if (!token) {
      return this.oauthError(400, 'invalid_client', 'Unknown client_id');
    }
    if (!this.validateRedirectUri(token, dto.redirect_uri)) {
      return this.oauthError(400, 'invalid_request', 'Invalid redirect_uri');
    }

    const record = await this.prisma.oAuthAuthorizationCode.findFirst({
      where: { code_hash: this.getCodeHash(dto.code) },
    });
    if (
      !record ||
      record.client_id !== dto.client_id ||
      record.redirect_uri !== dto.redirect_uri ||
      record.revoked_at ||
      record.used_at ||
      record.expires_at.getTime() < Date.now()
    ) {
      await this.audit({
        action: 'oauth_token_exchange',
        success: false,
        reason: 'invalid_grant',
        client_id: dto.client_id,
        organization_id: record?.organization_id || null,
        organization_token_id: record?.organization_token_id || null,
        company_id: record?.company_id || null,
        user_id: record?.user_id || null,
        req,
      });
      return this.oauthError(400, 'invalid_grant', 'Invalid or expired code');
    }

    const pkceOk = this.verifyPkce(dto.code_verifier, record.code_challenge);
    if (!pkceOk) {
      await this.audit({
        action: 'oauth_token_exchange',
        success: false,
        reason: 'pkce_failed',
        client_id: dto.client_id,
        organization_id: record.organization_id,
        organization_token_id: record.organization_token_id,
        company_id: record.company_id,
        user_id: record.user_id,
        req,
      });
      return this.oauthError(400, 'invalid_grant', 'PKCE verification failed');
    }

    await this.prisma.oAuthAuthorizationCode.update({
      where: { id: record.id },
      data: { used_at: this.now() },
    });

    const user = await this.prisma.user.findFirst({
      where: { id: record.user_id || '' },
    });
    if (!user) {
      return this.oauthError(400, 'invalid_grant', 'User not found');
    }

    const csrfToken = this.base64url(crypto.randomBytes(32));
    const csrfTokenHash = this.sha256Hex(
      `${csrfToken}.${this.requireEnv('OAUTH_CSRF_PEPPER')}`,
    );

    const session = await this.prisma.oAuthSession.create({
      data: {
        client_id: dto.client_id,
        user_id: user.id,
        organization_id: record.organization_id,
        organization_token_id: record.organization_token_id,
        company_id: record.company_id,
        device_fingerprint_hash: this.getDeviceFingerprintHash(req),
        ip_address: this.getIp(req),
        user_agent: this.getUserAgent(req),
        csrf_token_hash: csrfTokenHash,
        last_seen: this.now(),
      },
    });

    const refreshTokenTtlDays = Number(
      process.env.OAUTH_REFRESH_TOKEN_TTL_DAYS || 30,
    );
    const refreshToken = this.base64url(crypto.randomBytes(48));
    const refreshHash = this.getRefreshTokenHash(refreshToken);
    const refreshExpiresAt = new Date(
      Date.now() + refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    );

    await this.prisma.oAuthRefreshToken.create({
      data: {
        token_hash: refreshHash,
        client_id: dto.client_id,
        session_id: session.id,
        user_id: user.id,
        expires_at: refreshExpiresAt,
      },
    });

    const { accessToken, expiresInSeconds } = await this.signAccessToken(
      user,
      dto.client_id,
    );

    await this.audit({
      action: 'oauth_token_exchange',
      success: true,
      client_id: dto.client_id,
      user_id: user.id,
      organization_id: record.organization_id,
      organization_token_id: record.organization_token_id,
      company_id: record.company_id,
      req,
    });

    const response: TokenResponse = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: expiresInSeconds,
      scope: record.scope.join(' ') || undefined,
    };

    return {
      response,
      refresh_token: refreshToken,
      csrf_token: csrfToken,
      session_id: session.id,
    };
  }

  private async refreshAccessToken(dto: OAuthTokenDto, req: Request) {
    const refreshToken = dto.refresh_token;
    if (!refreshToken) {
      return this.oauthError(400, 'invalid_request', 'Missing refresh_token');
    }
    const record = await this.prisma.oAuthRefreshToken.findFirst({
      where: { token_hash: this.getRefreshTokenHash(refreshToken) },
      include: { session: true },
    });
    if (
      !record ||
      record.client_id !== dto.client_id ||
      record.revoked_at ||
      record.expires_at.getTime() < Date.now() ||
      !record.session ||
      record.session.revoked_at
    ) {
      await this.audit({
        action: 'oauth_token_refresh',
        success: false,
        reason: 'invalid_grant',
        client_id: dto.client_id,
        user_id: record?.user_id || null,
        req,
      });
      return this.oauthError(400, 'invalid_grant', 'Invalid refresh_token');
    }

    const csrfHeader =
      (req.headers['x-csrf-token'] as string | undefined) || '';
    const csrfHash = this.sha256Hex(
      `${csrfHeader}.${this.requireEnv('OAUTH_CSRF_PEPPER')}`,
    );
    if (
      !csrfHeader ||
      !crypto.timingSafeEqual(
        Buffer.from(csrfHash),
        Buffer.from(record.session.csrf_token_hash),
      )
    ) {
      await this.audit({
        action: 'oauth_token_refresh',
        success: false,
        reason: 'csrf_failed',
        client_id: dto.client_id,
        user_id: record.user_id,
        req,
      });
      return this.oauthError(401, 'invalid_request', 'CSRF validation failed');
    }

    const fingerprintHash = this.getDeviceFingerprintHash(req);
    if (
      !crypto.timingSafeEqual(
        Buffer.from(fingerprintHash),
        Buffer.from(record.session.device_fingerprint_hash),
      )
    ) {
      await this.audit({
        action: 'oauth_token_refresh',
        success: false,
        reason: 'fingerprint_mismatch',
        client_id: dto.client_id,
        user_id: record.user_id,
        req,
      });
      return this.oauthError(401, 'invalid_grant', 'Session mismatch');
    }

    await this.prisma.oAuthRefreshToken.update({
      where: { id: record.id },
      data: { revoked_at: this.now() },
    });

    const csrfToken = this.base64url(crypto.randomBytes(32));
    const newCsrfHash = this.sha256Hex(
      `${csrfToken}.${this.requireEnv('OAUTH_CSRF_PEPPER')}`,
    );
    await this.prisma.oAuthSession.update({
      where: { id: record.session_id },
      data: { csrf_token_hash: newCsrfHash, last_seen: this.now() },
    });

    const refreshTokenTtlDays = Number(
      process.env.OAUTH_REFRESH_TOKEN_TTL_DAYS || 30,
    );
    const newRefreshToken = this.base64url(crypto.randomBytes(48));
    const newRefreshHash = this.getRefreshTokenHash(newRefreshToken);
    const refreshExpiresAt = new Date(
      Date.now() + refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    );

    await this.prisma.oAuthRefreshToken.create({
      data: {
        token_hash: newRefreshHash,
        client_id: dto.client_id,
        session_id: record.session_id,
        user_id: record.user_id,
        expires_at: refreshExpiresAt,
      },
    });

    const user = await this.prisma.user.findFirst({
      where: { id: record.user_id || '' },
    });
    if (!user) throw new UnauthorizedException();

    const { accessToken, expiresInSeconds } = await this.signAccessToken(
      user,
      dto.client_id,
    );

    await this.audit({
      action: 'oauth_token_refresh',
      success: true,
      client_id: dto.client_id,
      user_id: record.user_id,
      req,
    });

    const response: TokenResponse = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: expiresInSeconds,
    };

    return {
      response,
      refresh_token: newRefreshToken,
      csrf_token: csrfToken,
      session_id: record.session_id,
    };
  }

  async revoke(params: {
    client_id: string;
    token: string | null;
    token_type_hint?: string;
    req: Request;
  }) {
    const typeHint = (params.token_type_hint || 'refresh_token').toLowerCase();
    if (!params.token) {
      return { status: 200 };
    }
    if (typeHint === 'access_token') {
      try {
        const payload: any = await this.jwt.verifyAsync(params.token, {
          publicKey: process.env.OAUTH_PUBLIC_KEY,
        });
        if (!payload?.jti || !payload?.exp) return { status: 200 };
        await this.prisma.oAuthRevokedAccessToken.upsert({
          where: { jti: payload.jti },
          create: {
            jti: payload.jti,
            client_id: params.client_id,
            user_id: payload.sub,
            exp: payload.exp,
          },
          update: {
            exp: payload.exp,
          },
        });
        await this.audit({
          action: 'oauth_revoke',
          success: true,
          client_id: params.client_id,
          user_id: payload.sub,
          req: params.req,
        });
        return { status: 200 };
      } catch {
        return { status: 200 };
      }
    }
    const hash = this.getRefreshTokenHash(params.token);
    const record = await this.prisma.oAuthRefreshToken.findFirst({
      where: { token_hash: hash, client_id: params.client_id },
    });
    if (record) {
      await this.prisma.oAuthRefreshToken.update({
        where: { id: record.id },
        data: { revoked_at: this.now() },
      });
      await this.prisma.oAuthSession.update({
        where: { id: record.session_id },
        data: { revoked_at: this.now() },
      });
      await this.audit({
        action: 'oauth_revoke',
        success: true,
        client_id: params.client_id,
        user_id: record.user_id,
        req: params.req,
      });
    }
    return { status: 200 };
  }

  async introspect(params: { token: string; req: Request }) {
    try {
      const payload: any = await this.jwt.verifyAsync(params.token, {
        publicKey: process.env.OAUTH_PUBLIC_KEY,
      });
      if (!payload?.exp) return { active: false };
      if (payload.exp * 1000 < Date.now()) return { active: false };
      if (payload.jti) {
        const revoked = await this.prisma.oAuthRevokedAccessToken.findFirst({
          where: { jti: payload.jti },
        });
        if (revoked) return { active: false };
      }
      await this.audit({
        action: 'oauth_introspect',
        success: true,
        client_id: payload.aud || null,
        user_id: payload.sub || null,
        req: params.req,
      });
      return {
        active: true,
        scope: Array.isArray(payload.scope)
          ? payload.scope.join(' ')
          : undefined,
        client_id: payload.aud,
        username: payload.email,
        sub: payload.sub,
        exp: payload.exp,
        iat: payload.iat,
      };
    } catch {
      await this.audit({
        action: 'oauth_introspect',
        success: false,
        reason: 'invalid_token',
        req: params.req,
      });
      return { active: false };
    }
  }

  async audit(params: {
    action: string;
    success: boolean;
    reason?: string;
    client_id?: string | null;
    user_id?: string | null;
    organization_id?: string | null;
    organization_token_id?: string | null;
    company_id?: string | null;
    metadata?: any;
    req: Request;
  }) {
    try {
      await this.prisma.oAuthAuditLog.create({
        data: {
          action: params.action,
          success: params.success,
          reason: params.reason || null,
          client_id: params.client_id || null,
          user_id: params.user_id || null,
          organization_id: params.organization_id || null,
          organization_token_id: params.organization_token_id || null,
          company_id: params.company_id || null,
          ip_address: this.getIp(params.req),
          user_agent: this.getUserAgent(params.req),
          metadata: params.metadata || null,
        },
      });
    } catch (error: any) {
      if (process.env.NODE_ENV !== 'production') {
        throw new ForbiddenException(error?.message || 'Audit logging failed');
      }
    }
  }

  /**
   * Register a new user within an organization
   */
  async register(params: {
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    client_id: string;
    req: Request;
  }) {
    const token = await this.prisma.organizationToken.findFirst({
      where: { id: params.client_id },
      include: { organization: true, company: true },
    });

    if (!token || !token.organization || !token.company) {
      await this.audit({
        action: 'oauth_register',
        success: false,
        reason: 'invalid_client',
        client_id: params.client_id,
        req: params.req,
      });
      return this.oauthError(400, 'invalid_client', 'Unknown client_id');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: params.email,
        organization_id: token.organization_id,
      },
    });

    if (existingUser) {
      await this.audit({
        action: 'oauth_register',
        success: false,
        reason: 'user_exists',
        organization_id: token.organization_id,
        organization_token_id: token.id,
        company_id: token.company_id,
        req: params.req,
      });
      return this.oauthError(409, 'invalid_request', 'User already exists');
    }

    try {
      const hashedPassword = await argon.hash(params.password);
      const user = await this.prisma.user.create({
        data: {
          email: params.email,
          password: hashedPassword,
          first_name: params.first_name || '',
          last_name: params.last_name || '',
          phone: params.phone || '',
          company_id: token.company_id,
          organization_id: token.organization_id,
          organization_token_id: token.id,
          ip_address: this.getIp(params.req),
          status: 'active',
          verified: token.verify_registration === false,
        },
      });

      await this.audit({
        action: 'oauth_register',
        success: true,
        user_id: user.id,
        organization_id: token.organization_id,
        organization_token_id: token.id,
        company_id: token.company_id,
        req: params.req,
      });

      if (!user.verified) {
        const time = expireIn(60 * 24);
        const verificationToken = gen6digit().toString();
        const reference = createReference(user.id, 60 * 24, 'register', { token: verificationToken });

        const organization = await this.prisma.organization.findFirst({
          where: { id: token.organization_id },
          include: { company: { include: { service_email: true } } }
        });

        await this.prisma.manual.create({
          data: {
            user_id: user.id,
            company_id: token.company_id,
            ip_address: this.getIp(params.req),
            purpose: 'register',
          },
        });

        let mailObject: Parameters<typeof this.mail.sendMail>[number] = {
          to: user.email,
          subject: 'Thank you for registering!',
          template: 'register',
          company_id: token.company_id,
          first_name: user.first_name,
          image: organization.photo || organization?.company?.service_email?.[0]?.photo,
          time: '24 hours',
          location: organization?.address,
          domain: organization?.website,
          companyName: organization?.name,
        };

        if (organization?.company?.service_email?.[0]?.verified) {
          mailObject = {
            ...mailObject,
            from: organization?.company?.service_email?.[0]?.email,
            username: organization?.company?.service_email?.[0]?.username,
            password: Decrypt(organization?.company?.service_email?.[0]?.password),
            host: organization?.company?.service_email?.[0]?.host,
            image: organization?.company?.service_email?.[0]?.photo,
          };
        }

        const type = token.verify_registration_type;
        const redirect_url = token.redirect_url;
        const tokenType = redirect_url && type == 'mail_link' ? false : true;
        const link = redirect_url + `?token=${verificationToken}&reference=${reference}&intent=register`;

        if (type != 'sms' || (type == 'sms' && !user.phone)) {
          mailObject = {
            ...mailObject,
            token: tokenType ? verificationToken : link,
            tokenType,
          };

          await this.mail.sendMail(mailObject);

          await this.prisma.mail.create({
            data: {
              user_id: user.id,
              token: tokenType ? verificationToken : link,
              company_id: token.company_id,
              purpose: 'register',
            },
          });
        } else {
          await this.sms.sendSMSToken({
            phone: user.phone,
            time: '24 hours',
            company_name: organization?.name,
            first_name: user.first_name,
            company_id: token.company_id,
            token: verificationToken,
          });

          await this.prisma.sms.create({
            data: {
              user_id: user.id,
              token: tokenType ? verificationToken : link,
              company_id: token.company_id,
              purpose: 'register',
            },
          });
        }

        await this.prisma.authorizationToken.create({
          data: {
            type: type == 'sms' ? 'sms' : 'mail',
            token: verificationToken,
            user_type: 'user',
            email: user.email,
            purpose: 'register',
            company_id: token.company_id,
            reference,
            expire_at: time,
          },
        });
      }

      return { success: true, user_id: user.id };
    } catch (error: any) {
      await this.audit({
        action: 'oauth_register',
        success: false,
        reason: 'registration_failed',
        organization_id: token.organization_id,
        organization_token_id: token.id,
        company_id: token.company_id,
        req: params.req,
      });
      console.error('Registration error:', error);
      return this.oauthError(500, 'server_error', `Registration failed: ${error.message}`);
    }
  }

  /**
   * Request a password reset token
   */
  async requestPasswordReset(params: {
    email: string;
    client_id: string;
    req: Request;
  }) {
    const token = await this.prisma.organizationToken.findFirst({
      where: { id: params.client_id },
      include: { organization: true, company: true },
    });

    if (!token || !token.organization || !token.company) {
      return this.oauthError(400, 'invalid_client', 'Unknown client_id');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        email: params.email,
        organization_id: token.organization_id,
      },
    });

    if (!user) {
      // Return success even if user not found (security best practice)
      await this.audit({
        action: 'oauth_password_reset_request',
        success: false,
        reason: 'user_not_found',
        organization_id: token.organization_id,
        organization_token_id: token.id,
        req: params.req,
      });
      return { success: true };
    }

    try {
      // Generate reset token
      const resetToken = this.base64url(crypto.randomBytes(32));
      const tokenHash = this.sha256Hex(
        `${resetToken}.${this.requireEnv('OAUTH_PASSWORD_RESET_PEPPER')}`,
      );

      // Create password reset record (15 minute expiration)
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await this.prisma.passwordReset.create({
        data: {
          token_hash: tokenHash,
          user_id: user.id,
          organization_token_id: token.id,
          email: user.email,
          purpose: 'password_reset',
          ip_address: this.getIp(params.req),
          user_agent: this.getUserAgent(params.req),
          expires_at: expiresAt,
        },
      });

      // Send reset email
      try {
        await this.mail.sendPasswordReset({
          to: user.email,
          reset_token: resetToken,
          user_name: `${user.first_name} ${user.last_name}`,
          reset_url: `${process.env.FRONTEND_URL}/password-reset?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(user.email)}`,
        });
      } catch (error: any) {
        console.error('Failed to send password reset email:', error);
      }

      await this.audit({
        action: 'oauth_password_reset_request',
        success: true,
        user_id: user.id,
        organization_id: token.organization_id,
        organization_token_id: token.id,
        company_id: user.company_id,
        req: params.req,
      });

      return { success: true };
    } catch (error: any) {
      await this.audit({
        action: 'oauth_password_reset_request',
        success: false,
        reason: 'reset_failed',
        user_id: user.id,
        organization_id: token.organization_id,
        organization_token_id: token.id,
        company_id: user.company_id,
        req: params.req,
      });
      return { success: true };
    }
  }

  /**
   * Verify password reset token
   */
  async verifyPasswordResetToken(params: {
    email: string;
    reset_token: string;
    client_id: string;
    req: Request;
  }) {
    const token = await this.prisma.organizationToken.findFirst({
      where: { id: params.client_id },
    });

    if (!token) {
      return { valid: false, error: 'invalid_client' };
    }

    const tokenHash = this.sha256Hex(
      `${params.reset_token}.${this.requireEnv('OAUTH_PASSWORD_RESET_PEPPER')}`,
    );

    const resetRecord = await this.prisma.passwordReset.findFirst({
      where: {
        token_hash: tokenHash,
        email: params.email,
        organization_token_id: token.id,
        used_at: null,
        revoked_at: null,
      },
    });

    if (!resetRecord || resetRecord.expires_at.getTime() < Date.now()) {
      await this.audit({
        action: 'oauth_password_reset_verify',
        success: false,
        reason: 'invalid_token',
        organization_token_id: token.id,
        req: params.req,
      });
      return { valid: false, error: 'invalid_token' };
    }

    await this.audit({
      action: 'oauth_password_reset_verify',
      success: true,
      user_id: resetRecord.user_id || undefined,
      organization_token_id: token.id,
      req: params.req,
    });

    return { valid: true };
  }

  /**
   * Reset password using token
   */
  async resetPassword(params: {
    email: string;
    new_password: string;
    reset_token: string;
    client_id: string;
    req: Request;
  }) {
    const token = await this.prisma.organizationToken.findFirst({
      where: { id: params.client_id },
    });

    if (!token) {
      return this.oauthError(400, 'invalid_client', 'Unknown client_id');
    }

    const tokenHash = this.sha256Hex(
      `${params.reset_token}.${this.requireEnv('OAUTH_PASSWORD_RESET_PEPPER')}`,
    );

    const resetRecord = await this.prisma.passwordReset.findFirst({
      where: {
        token_hash: tokenHash,
        email: params.email,
        organization_token_id: token.id,
        used_at: null,
        revoked_at: null,
      },
    });

    if (!resetRecord || resetRecord.expires_at.getTime() < Date.now()) {
      await this.audit({
        action: 'oauth_password_reset',
        success: false,
        reason: 'invalid_token',
        organization_token_id: token.id,
        req: params.req,
      });
      return this.oauthError(
        400,
        'invalid_grant',
        'Invalid or expired reset token',
      );
    }

    try {
      const hashedPassword = await argon.hash(params.new_password);

      // Update user password
      await this.prisma.user.update({
        where: { id: resetRecord.user_id || '' },
        data: { password: hashedPassword },
      });

      // Mark reset token as used
      await this.prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { used_at: this.now() },
      });

      // Revoke all existing refresh tokens and sessions for security
      await this.prisma.oAuthRefreshToken.updateMany({
        where: {
          user_id: resetRecord.user_id || '',
          revoked_at: null,
        },
        data: { revoked_at: this.now() },
      });

      await this.prisma.oAuthSession.updateMany({
        where: {
          user_id: resetRecord.user_id || '',
          revoked_at: null,
        },
        data: { revoked_at: this.now() },
      });

      await this.audit({
        action: 'oauth_password_reset',
        success: true,
        user_id: resetRecord.user_id || undefined,
        organization_token_id: token.id,
        req: params.req,
      });

      return { success: true };
    } catch (error: any) {
      await this.audit({
        action: 'oauth_password_reset',
        success: false,
        reason: 'reset_failed',
        user_id: resetRecord.user_id || undefined,
        organization_token_id: token.id,
        req: params.req,
      });
      return this.oauthError(500, 'server_error', 'Password reset failed');
    }
  }
}
