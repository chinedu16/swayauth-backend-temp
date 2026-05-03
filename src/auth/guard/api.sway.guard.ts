import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthType } from '../type';

@Injectable()
export class ApiOrSwayGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { token, type } = this.extractTokenFromHeader(request);
    if (!type) throw new UnauthorizedException();
    if (type === 'Application-Key') {
      const company = await this.prisma.company.findFirst({
        where: {
          app_key: {
            key: token,
          },
        },
      });
      if (!company) throw new UnauthorizedException();
      request['company'] = company;
    }
    request['auth_type'] = type;
    return true;
  }

  private extractTokenFromHeader(request: Request): {
    type: AuthType;
    token: string | null;
  } {
    const api_key = (request.headers['application-key'] ||
      request.headers['swayauth-identifier']) as string;
    if (api_key) {
      if (api_key == process.env.SWAYAUTH_IDENTITY) {
        return { type: 'Swayauth-Identifier', token: null };
      } else {
        return { type: 'Application-Key', token: api_key };
      }
    } else {
      return { type: null, token: null };
    }
  }
}
