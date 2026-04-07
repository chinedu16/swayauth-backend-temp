import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthType, JWTProp } from '../type/jwt.type';

@Injectable()
export class UserOrCompanyGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { token, type } = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      if (type === 'Bearer') {
        const user = (await this.jwtService.verifyAsync(token, {
          secret: process.env.JWT_SECRET,
        })) as JWTProp;
        if (!['level_3', 'level_2'].includes(user.access))
          throw new UnauthorizedException();
        request['user'] = user;
        request['company'] = null;
      } else {
        const company = await this.prisma.company.findFirst({
          where: {
            app_key: {
              key: token,
            },
          },
        });
        if (!company) throw new UnauthorizedException();
        request['user'] = null;
        request['company'] = company;
      }
      request['auth_type'] = type;
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): {
    type: AuthType;
    token: string | null;
  } {
    const api_key = request.headers['application-key'] as AuthType | undefined;
    if (api_key) {
      return { type: 'Application-Key', token: api_key };
    } else {
      const [type, token] = request.headers?.authorization?.split(' ') ?? [];
      return type === 'Bearer'
        ? { type: 'Bearer', token }
        : { type: null, token: null };
    }
  }
}
