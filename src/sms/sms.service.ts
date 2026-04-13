import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { CONST } from '../common';
import { SubscriptionService } from '../subscription/subscription.service';

@Injectable()
export class SmsService {
  constructor(private subscription: SubscriptionService) {}

  async sendSMSToken(
    {
      phone,
      token,
      first_name,
      company_id,
      time = '15 minutes',
      company_name = process.env.SWAYAUTH_COMPANY_NAME,
    }: {
      phone: string | number;
      token: number | string;
      time?: string;
      first_name?: string;
      company_name?: string;
      company_id: string;
    },
    checkSubscription: boolean = true,
  ) {
    void company_id;
    void checkSubscription;
    const url = CONST.SEND_SMS_URL;

    try {
      const { data } = await axios.post(
        url,
        {
          sender_name: 'SAlert',
          route: 'dnd',
          message: `${first_name ? `Hi ${first_name}` : 'Hi'}, your ${company_name || ''} authentication code is ${token}. active for ${time || '15 minutes'}. one-time use only.`,
          to: phone,
        },
        {
          headers: {
            Authorization: 'Bearer ' + process.env.SENDCHAMP_API_KEY,
          },
        },
      );
      return { status: data?.status === 'success' };
    } catch (error: any) {
      return { status: false, message: error.message };
    }
  }

  async verifySMSToken({
    reference,
    token,
  }: {
    reference: string;
    token: number | string;
  }) {
    const url = CONST.VERIFY_SMS_URL;
    try {
      const { data } = await axios.post(
        url,
        {
          verification_reference: reference,
          verification_code: token,
        },
        {
          headers: {
            Authorization: 'Bearer ' + process.env.SENDCHAMP_API_KEY,
          },
        },
      );
      return data;
    } catch (error: any) {
      return { status: false, message: error.message };
    }
  }
}
