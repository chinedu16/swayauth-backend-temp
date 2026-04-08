import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';

export enum PlanEnum {
  standard = 'standard',
  premium = 'premium',
}

export enum PaymentMethod {
  card = 'card',
  paystack = 'paystack',
  wallet = 'wallet',
}

export class SubscriptionDto {
  @IsEnum(PlanEnum, {
    message: 'plan must be one of the following values: standard, premium',
  })
  plan: PlanEnum;

  @IsEnum(PaymentMethod, {
    message: 'payWith must be one of the following values: card, wallet',
  })
  payWith: PaymentMethod;
}

export class NewsLetter {
  @IsEmail()
  email: string;
}
