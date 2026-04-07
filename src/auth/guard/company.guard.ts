import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { $Enums } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthType, JWTProp } from '../type/jwt.type';

@Injectable()
export class CompanyGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { token, type } = this.extractTokenFromHeader(request);
    if (!type || !token) throw new UnauthorizedException();
    if (type === 'Bearer') {
      const user = (await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      })) as JWTProp;
      if (user.access === 'level_1') throw new UnauthorizedException();
      const company = await this.prisma.company.findFirst({
        where: {
          id: user.company_id,
        },
      });
      if (!company) throw new UnauthorizedException();
      request['user'] = user;
      request['access'] = user.access;
      request['permissions'] = user.permissions;
      request['company'] = company;
    } else if (type === 'Application-Key') {
      const company = await this.prisma.company.findFirst({
        where: {
          app_key: {
            key: token,
          },
        },
      });
      if (!company) throw new UnauthorizedException();
      request['user'] = null;
      request['access'] = $Enums.access.level_3;
      request['permissions'] = ['read', 'write', 'delete'];
      request['company'] = company;
    }
    request['auth_type'] = type;
    return true;
  }

  private extractTokenFromHeader(request: Request): {
    type: AuthType;
    token: string | null;
  } {
    const api_key = request.headers['application-key'] as string | undefined;
    if (api_key) {
      return { type: 'Application-Key', token: api_key };
    } else {
      const [type, token] = request.headers.authorization?.split(' ') ?? [];
      return type === 'Bearer'
        ? { type: 'Bearer', token }
        : { type: null, token: null };
    }
  }
}
