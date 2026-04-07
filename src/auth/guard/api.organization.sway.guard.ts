import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthType } from '../type';

@Injectable()
export class ApiOrOrganizationOrSwayGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { token, type } = this.extractTokenFromHeader(request);
    if (!type || (!token && type === 'Swayauth-Identifier'))
      throw new UnauthorizedException();
    try {
      request['company'] = null;
      if (type === 'Application-Key') {
        if (token.substring(token.length - 3) != 'app')
          throw new UnauthorizedException();
        const payload = await this.prisma.company.findFirst({
          where: {
            app_key: {
              key: token,
            },
          },
        });
        if (!payload) throw new UnauthorizedException();
        request['company'] = payload;
      } else if (type === 'Organization-Secret') {
        if (token.substring(token.length - 12) != 'organization')
          throw new UnauthorizedException();
        const payload = await this.prisma.organizationToken.findFirst({
          where: {
            api_key: token,
          },
          select: {
            organization: {
              select: {
                company: true,
              },
            },
          },
        });
        if (!payload.organization.company) throw new UnauthorizedException();
        request['company'] = payload.organization.company;
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
    const api_key = (request.headers['application-key'] ||
      request.headers['organization-secret'] ||
      request.headers['swayauth-identifier']) as string;
    if (api_key) {
      if (api_key == process.env.SWAYAUTH_IDENTITY) {
        return { type: 'Swayauth-Identifier', token: null };
      } else if (api_key?.substring(api_key?.length - 12) == 'organization') {
        return { type: 'Organization-Secret', token: api_key };
      } else {
        return { type: 'Application-Key', token: api_key };
      }
    }
    return { type: null, token: null };
  }
}
