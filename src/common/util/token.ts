import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { GenericResponse } from '../type/response';
import { Decrypt, Encrypt } from './crypto';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

export const generateTotp = (
  company_name: string,
  email: string,
): Promise<GenericResponse<{ secret: string; img: string }>> =>
  new Promise((resolve) => {
    const { otpauth_url, base32 } = speakeasy.generateSecret({
      name: company_name + `: ${email}`,
    });
    qrcode.toDataURL(otpauth_url, (err, imgUrl) => {
      if (err) return resolve({ status: false, message: err.message });
      resolve({ status: true, data: { secret: base32, img: imgUrl } });
    });
  });

export const verifyTotp = (secret: string, token: string) => {
  return speakeasy.totp.verify({
    secret,
    token,
    encoding: 'base32',
  });
};

export const gen6digit = () =>
  Math.floor(Math.random() * (999999 - 100000) + 100000);

export const expireIn = (minutes: number) => {
  const oneMinute = 1000 * 60;
  return new Date(Date.now() + oneMinute * minutes).getTime();
};

export const verifyTime = (time: number) => {
  const currentTime = new Date().getTime();
  return time > currentTime;
};

export const createReference = (
  id: string,
  durationInMinutes: number,
  purpose:
    | 'login'
    | 'forgot-password'
    | 'smtp'
    | 'register'
    | 'team'
    | 'enable-2factor' = 'login',
  meta: { [key: string]: any; token: string },
) => {
  return Encrypt(
    JSON.stringify({
      id,
      purpose,
      duration: expireIn(durationInMinutes),
      ...meta,
    }),
  );
};

export const verifyReference = <
  T extends any,
  U extends {
    id: string;
    token: string;
    email?: string;
    set_password?: boolean;
    duration: number;
    association_id?: string;
    purpose:
      | 'login'
      | 'forgot-password'
      | 'register'
      | 'team'
      | 'enable-2factor';
  } & T = {
    id: string;
    token: string;
    email?: string;
    duration: number;
    set_password?: boolean;
    association_id?: string;
    purpose:
      | 'login'
      | 'forgot-password'
      | 'register'
      | 'team'
      | 'enable-2factor';
  } & T,
>(
  reference: string,
): U => {
  const decrypt = Decrypt(reference);
  if (!decrypt)
    throw new BadRequestException('Invalid / expired  reference & token');
  const data = JSON.parse(decrypt) as U;
  if (verifyTime(data?.duration)) {
    return data;
  } else {
    throw new UnauthorizedException('Invalid / expired  reference & token');
  }
};
