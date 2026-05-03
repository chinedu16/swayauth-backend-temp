import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AccountModule } from './account/account.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { BlogModule } from './blog/blog.module';
import { ClientModule } from './client/client.module';
import { CronjobModule } from './cronjob/cronjob.module';
import { FacebookModule } from './facebook/facebook.module';
import { GoogleModule } from './google/google.module';
import { MailModule } from './mail/mail.module';
import { PaymentModule } from './payment/payment.module';
import { PrismaModule } from './prisma/prisma.module';
import { SmsModule } from './sms/sms.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { UploadModule } from './upload/upload.module';
import { UserModule } from './user/user.module';
import { HealthModule } from './health/health.module';
import { OAuthModule } from './oauth/oauth.module';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 1000,
        limit: 50,
      },
    ]),
    MailModule,
    SubscriptionModule,
    CronjobModule,
    SmsModule,
    BlogModule,
    GoogleModule,
    FacebookModule,
    UploadModule,
    PaymentModule,
    PrismaModule,
    AuthModule,
    UserModule,
    AdminModule,
    ClientModule,
    AccountModule,
    HealthModule,
    OAuthModule,
  ],
  controllers: [DashboardController],
})
export class AppModule {}
