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
export class OrganizationGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const secret = this.extractTokenFromHeader(request);
    if (!secret || secret.substring(secret.length - 12) != 'organization') {
      throw new UnauthorizedException();
    }
    try {
      const orgToken = await this.prisma.organizationToken.findFirst({
        where: {
          api_key: secret,
        },
      });
      if (!orgToken) throw new UnauthorizedException();
      request['organizationToken'] = orgToken;
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    return request.headers['organization-secret'] as AuthType;
  }
}
