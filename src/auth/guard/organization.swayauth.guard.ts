import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthType } from '../type';

@Injectable()
export class OrganizationOrSwayauthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { token, type } = this.extractTokenFromHeader(request);
    if (!type || (!token && type != 'Swayauth-Identifier'))
      throw new UnauthorizedException();
    try {
      request['organizationToken'] = null;
      if (type === 'Organization-Secret') {
        const organizationToken = await this.prisma.organizationToken.findFirst(
          {
            where: {
              api_key: token,
            },
          },
        );
        if (!organizationToken) throw new UnauthorizedException();
        request['organizationToken'] = organizationToken;
      }
    } catch {
      throw new UnauthorizedException();
    }
    request['auth_type'] = type;
    return true;
  }

  private extractTokenFromHeader(request: Request): {
    type: AuthType;
    token: string | null;
  } {
    const api_key = (request.headers['organization-secret'] ||
      request.headers['swayauth-identifier']) as string;
    if (api_key) {
      if (api_key == process.env.SWAYAUTH_IDENTITY) {
        return { type: 'Swayauth-Identifier', token: null };
      } else if (api_key?.substring(api_key?.length - 12) == 'organization') {
        return { type: 'Organization-Secret', token: api_key };
      } else {
        return { type: null, token: null };
      }
    } else {
      return { type: null, token: null };
    }
  }
}
