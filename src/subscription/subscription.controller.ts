import { Body, Controller, Get, Ip, Post, UseGuards } from '@nestjs/common';
import { Company } from '@prisma/client';
import { GetCompany } from 'src/client/decorator';
import {
  AccessGuard,
  CompanyGuard,
  PermissionGuard,
  UserGuard,
} from '../auth/guard';
import { NewsLetter, SubscriptionDto } from './subscription.dto';
import { SubscriptionService } from './subscription.service';
import { GetUser } from 'src/user/decorator';
import { JWTProp } from 'src/auth/type';

@Controller({ version: '1', path: 'subscription' })
export class SubscriptionController {
  constructor(private subscriptionService: SubscriptionService) {}

  @Get()
  @UseGuards(CompanyGuard)
  getSubscription(@GetCompany() company: Company) {
    return this.subscriptionService.getSubscription(company);
  }

  @Post('newsletter')
  newsLetter(@Ip() ip: string, @Body() dto: NewsLetter) {
    return this.subscriptionService.newsLetter(dto, ip);
  }

  @Post('upgrade')
  @UseGuards(new PermissionGuard('write'))
  @UseGuards(new AccessGuard(['level_3']))
  @UseGuards(UserGuard)
  upgradeSubscription(@Body() dto: SubscriptionDto, @GetUser() jwt: JWTProp) {
    return this.subscriptionService.createSubscription(jwt, dto);
  }
}
