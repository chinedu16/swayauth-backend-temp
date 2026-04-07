import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Company } from '@prisma/client';
import { JWTProp } from '../../auth/type';
import { generateAppKey } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CredentialsService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async getAppKey(company: Company) {
    return await this.prisma.appKey.findFirst({
      where: {
        id: company.app_key_id,
      },
    });
  }

  async jwtVerify(token: string) {
    try {
      return (await this.jwt.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      })) as JWTProp;
    } catch (error: any) {
      throw new UnauthorizedException('jwt verification failed');
    }
  }

  async rotateKey(company: Company) {
    const appKey = generateAppKey(company.email);
    return await this.prisma.appKey.update({
      where: {
        id: company.app_key_id,
      },
      data: {
        key: appKey,
      },
    });
  }
}
