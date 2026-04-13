import { Injectable } from '@nestjs/common';
import { SubscriptionService } from '../subscription/subscription.service';

@Injectable()
export class CronjobService {
  constructor(private subscriptionService: SubscriptionService) {}
  //24 hours
  // @Interval(1000 * 60 * 60 * 24)
  // handleInterval() {
  //   this.subscriptionService.autoSubscriptionCronJob()
  // }
}
