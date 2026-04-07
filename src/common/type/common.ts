import { $Enums, Company } from '@prisma/client';
import { JWTProp } from 'src/auth/type';

export type GetCompanyOrUserProp =
  | {
      type: 'user';
      data: JWTProp;
    }
  | {
      type: 'company';
      data: Company;
    };

export interface GenerateToken {
  id: string;
  email: string;
  scope: $Enums.scope[];
  two_factor_type: $Enums.two_factor_type;
  permissions: $Enums.permissions[];
  status: $Enums.status;
  company_id: string;
  organization_token_id?: string | null;
  organization_id?: string | null;
  access: $Enums.access;
}

export enum DurationEnum {
  '7_days' = '7_days',
  '14_days' = '14_days',
  '30_days' = '30_days',
  '6_months' = '6_months',
  '1_year' = '1_year',
}

export interface GenerateAccessCodeResult {
  data: {
    status: boolean;
    message: string;
    data: {
      authorization_url: string;
      access_code: string;
      reference: string;
    };
  };
}

export interface SingleTransaction {
  id: number;
  amount: string;
  currency: string; // NGN
  transaction_date: Date;
  status: string; // success | failed | pending
  reference: string;
  domain: string;
  gateway_response: string; // Successful | Failed | Approved (reoccuring)
  metadata: {
    transaction_type: 'wallet' | 'subscription';
    company_id: string;
    subscription_type?: 'standard' | 'premium';
    company_name?: string;
    purpose: string;
    save_card: 'true' | 'false';
  };
  channel: string; // card
  ip_address: string | null;
  plan: string | null;
  fees: number;
  message: string | null;
  paid_at: Date;
  created_at: Date;
  authorization: {
    authorization_code: string; // i.e AUTH_ahisucjkru important for subsequent transactions
    bin: string;
    last4: string; // last four digits of card
    exp_month: string; // i.e 12
    exp_year: string; // i.e. 2015
    channel: string; // i.e card
    card_type: string; // i.e visa
    bank: string; // i.e First Bank
    country_code: string;
    brand: string; // i.e visa
    reusable: boolean;
    signature: string; // i.e SIG_yEXu7dLBeqG0kU7g95Ke *unknown importance*
    account_name: string;
  };
  customer: {
    id: number;
    first_name: string | null;
    last_name: string | null;
    email: string;
    customer_code: string;
    phone: string | null;
    metadata: string | null;
    risk_action: string; // i.e default
    international_format_phone: string | null;
  };
  fees_split?: boolean | null;
  split?: object;
  order_id: string | null;
  paidAt?: Date;
  createdAt?: Date;
  requested_amount?: number;
  pos_transaction_data?: object | string | null;
  source?: string | null;
  fees_breakdown?: object | null;
  plan_object?: object;
  subaccount?: object;
}
