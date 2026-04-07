import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthType } from '../type';

@Injectable()
export class UserOrSwayGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { token, type } = this.extractTokenFromHeader(request);
    if (!type) throw new UnauthorizedException();
    if (type === 'Bearer') {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
      request['user'] = payload;
    }
    request['auth_type'] = type;
    return true;
  }

  private extractTokenFromHeader(request: Request): {
    type: AuthType;
    token: string | null;
  } {
    const api_key = (request.headers.authorization?.split(' ')?.[1] ||
      request.headers?.['swayauth-identifier']) as string;
    if (api_key) {
      if (api_key == process.env.SWAYAUTH_IDENTITY) {
        return { type: 'Swayauth-Identifier', token: null };
      } else {
        return { type: 'Bearer', token: api_key };
      }
    } else {
      return { type: null, token: null };
    }
  }
}
