import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { CONST, GenerateAccessCodeResult, GenericResponse } from 'src/common';

@Injectable()
export class PaymentService {
  async getBalance(): Promise<
    GenericResponse<{ currency: string; balance: number } | null>
  > {
    try {
      const res: {
        data: GenericResponse<{ currency: string; balance: number }>;
      } = await axios.get(CONST.PAYSTACK_BASE_URL + '/balance', {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY as string}`,
          'Content-Type': 'application/json',
        },
      });
      return {
        ...res.data,
        data: Array.isArray(res.data.data)
          ? res.data?.data?.[0]
          : res.data?.data,
      };
    } catch (error: any) {
      return { status: false, message: error?.message, data: null };
    }
  }

  async generateAccessCode({
    email,
    amount,
    metadata,
  }: {
    email: string;
    amount: number;
    metadata: {
      transaction_type: 'wallet' | 'subscription';
      company_id: string;
      subscription_type?: string;
      company_name?: string;
      purpose: string;
      save_card: 'true' | 'false';
    };
  }) {
    try {
      const res: GenerateAccessCodeResult = await axios.post(
        CONST.PAYSTACK_BASE_URL + '/transaction/initialize',
        {
          email, // customer email address
          amount: amount + '00', // amount for the transaction in kobo
          metadata,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY as string}`,
            'Content-Type': 'application/json',
          },
        },
      );
      return res.data;
    } catch (error: any) {
      return {
        status: false,
        message: error?.message,
        data: null,
      } as GenerateAccessCodeResult;
    }
  }

  async chargeSavedCard({
    authorization_code,
    email,
    amount,
    metadata,
  }: {
    authorization_code?: string;
    email: string;
    amount: number;
    metadata?: {
      transaction_type: 'wallet' | 'subscription';
      company_id: string;
      subscription_type?: 'standard' | 'premium';
      company_name?: string;
      purpose: string;
      save_card: 'true' | 'false';
    };
  }) {
    try {
      const res: GenerateAccessCodeResult = await axios.post(
        CONST.PAYSTACK_BASE_URL + '/transaction/charge_authorization',
        {
          authorization_code, // saved authorization_code from used, stored card
          email, // customer email address
          amount: amount + '00', // amount for the transaction in kobo
          metadata,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY as string}`,
            'Content-Type': 'application/json',
          },
        },
      );
      return res.data;
    } catch (error: any) {
      return {
        status: false,
        message: error?.message,
        data: null,
      } as GenerateAccessCodeResult;
    }
  }
}
