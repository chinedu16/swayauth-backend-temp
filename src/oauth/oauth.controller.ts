import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request, Response } from 'express';
import {
  OAuthAuthorizeDto,
  OAuthIntrospectDto,
  OAuthRevokeDto,
  OAuthTokenDto,
  OAuthRegisterDto,
  PasswordResetRequestDto,
  PasswordResetConfirmDto,
  PasswordResetVerifyDto,
} from './dto/oauth.dto';
import { OAuthService } from './oauth.service';

@Controller({ version: '1', path: 'oauth' })
@UseGuards(ThrottlerGuard)
export class OAuthController {
  constructor(private oauth: OAuthService) {}

  private cookieNames() {
    return {
      refresh: process.env.OAUTH_REFRESH_COOKIE_NAME || 'swayauth_rt',
      session: process.env.OAUTH_SESSION_COOKIE_NAME || 'swayauth_sid',
      csrf: process.env.OAUTH_CSRF_COOKIE_NAME || 'swayauth_csrf',
    };
  }

  private cookieOptions(httpOnly: boolean) {
    return {
      httpOnly,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/v1/oauth',
    };
  }

  @Post('authorize')
  @Throttle({ default: { limit: 10, ttl: 900 } })
  @HttpCode(HttpStatus.FOUND)
  async authorize(
    @Body() dto: OAuthAuthorizeDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const out = await this.oauth.authorize({ ...dto, req });
    if ('error' in out) {
      try {
        const url = new URL(dto.redirect_uri);
        url.searchParams.set('error', out.error);
        if (out.error_description) {
          url.searchParams.set('error_description', out.error_description);
        }
        if (dto.state) url.searchParams.set('state', dto.state);
        return res.redirect(HttpStatus.FOUND, url.toString());
      } catch {
        return res.status(out.status).json(out);
      }
    }
    const url = new URL(out.redirect_uri);
    url.searchParams.set('code', out.code);
    if (out.state) url.searchParams.set('state', out.state);
    return res.redirect(HttpStatus.FOUND, url.toString());
  }

  @Post('token')
  @Throttle({ default: { limit: 20, ttl: 900 } })
  @HttpCode(HttpStatus.OK)
  async token(
    @Body() dto: OAuthTokenDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const names = this.cookieNames();
    const refreshFromCookie = (req as any).cookies?.[names.refresh] as
      | string
      | undefined;
    const resolvedDto = {
      ...dto,
      refresh_token: dto.refresh_token || refreshFromCookie,
    };

    const out = await this.oauth.token(resolvedDto, req);
    if ('error' in out) {
      return res.status(out.status).json({
        error: out.error,
        error_description: out.error_description,
      });
    }

    res.cookie(names.refresh, out.refresh_token, this.cookieOptions(true));
    res.cookie(names.session, out.session_id, this.cookieOptions(true));
    res.cookie(names.csrf, out.csrf_token, this.cookieOptions(false));
    return res.status(HttpStatus.OK).json(out.response);
  }

  @Post('revoke')
  @Throttle({ default: { limit: 20, ttl: 900 } })
  @HttpCode(HttpStatus.OK)
  async revoke(
    @Body() dto: OAuthRevokeDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const names = this.cookieNames();
    const token =
      dto.token ||
      ((req as any).cookies?.[names.refresh] as string | undefined) ||
      null;
    await this.oauth.revoke({
      client_id: (req.body?.client_id as string) || '',
      token,
      token_type_hint: dto.token_type_hint,
      req,
    });
    res.clearCookie(names.refresh, this.cookieOptions(true));
    res.clearCookie(names.session, this.cookieOptions(true));
    res.clearCookie(names.csrf, this.cookieOptions(false));
    return res.status(HttpStatus.OK).json({});
  }

  @Post('introspect')
  @Throttle({ default: { limit: 20, ttl: 900 } })
  @HttpCode(HttpStatus.OK)
  async introspect(
    @Body() dto: OAuthIntrospectDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const out = await this.oauth.introspect({ token: dto.token, req });
    return res.status(HttpStatus.OK).json(out);
  }

  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 900 } })
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: OAuthRegisterDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const out = await this.oauth.register({
      email: dto.email,
      password: dto.password,
      first_name: dto.first_name,
      last_name: dto.last_name,
      phone: dto.phone,
      client_id: dto.client_id,
      req,
    });

    if ('error' in out) {
      return res.status(out.status).json({
        error: out.error,
        error_description: out.error_description,
      });
    }

    return res.status(HttpStatus.CREATED).json(out);
  }

  @Post('password-reset/request')
  @Throttle({ default: { limit: 5, ttl: 3600 } })
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(
    @Body() dto: PasswordResetRequestDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const out = await this.oauth.requestPasswordReset({
      email: dto.email,
      client_id: dto.client_id,
      req,
    });

    // Always return success for security
    return res.status(HttpStatus.OK).json(out);
  }

  @Post('password-reset/verify')
  @Throttle({ default: { limit: 5, ttl: 3600 } })
  @HttpCode(HttpStatus.OK)
  async verifyPasswordResetToken(
    @Body() dto: PasswordResetVerifyDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const out = await this.oauth.verifyPasswordResetToken({
      email: dto.email,
      reset_token: dto.reset_token,
      client_id: dto.client_id,
      req,
    });

    return res.status(HttpStatus.OK).json(out);
  }

  @Post('password-reset/confirm')
  @Throttle({ default: { limit: 5, ttl: 3600 } })
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: PasswordResetConfirmDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const out = await this.oauth.resetPassword({
      email: dto.email,
      new_password: dto.new_password,
      reset_token: dto.reset_token,
      client_id: dto.client_id,
      req,
    });

    if ('error' in out) {
      return res.status(out.status).json({
        error: out.error,
        error_description: out.error_description,
      });
    }

    return res.status(HttpStatus.OK).json(out);
  }
}
