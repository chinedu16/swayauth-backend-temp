import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { MailModule } from '../mail/mail.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [JwtModule.register({}), MailModule, PrismaModule],
  controllers: [OAuthController],
  providers: [OAuthService],
})
export class OAuthModule {}
