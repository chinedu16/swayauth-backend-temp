import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { Injectable } from '@nestjs/common';
import { Subscription } from '@prisma/client';
import fs from 'fs';
import { handlebars } from 'hbs';
import nodemailer from 'nodemailer';
import path from 'path';
import { SendMailClient } from 'zeptomail';
import { CONST } from '../common';
import { PrismaService } from '../prisma/prisma.service';

const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

const templateTypes = [
  'forgot-password',
  'google',
  'login',
  'subscription-expires',
  'subscription-renewal',
  'subscription-failed',
  'team-invite',
  'register',
  'register-complete',
  'wallet',
  'smtp',
  'social-register',
  'reset-password',
  'two-factor',
] as const;

@Injectable()
export class MailService {
  constructor(private prisma: PrismaService) {}

  async sendMail(
    {
      to,
      tokenType,
      template,
      subject,
      token,
      first_name,
      time = '15 minutes',
      domain,
      from,
      amount,
      image,
      company_id: _company_id,
      companyName,
      location,
      fromName,
      plan,
      password,
      username,
      host,
      expire,
      ...rest
    }: {
      to: string;
      subject: string;
      template: (typeof templateTypes)[number];
      company_id: string;
      amount?: number;
      tokenType?: boolean;
      token?: string | number;
      time?: number | string;
      domain?: string;
      from?: string;
      fromName?: string;
      plan?: string;
      companyName?: string;
      location?: string;
      image?: string;
      first_name?: string;
      username?: string;
      expire?: string;
      password?: string;
      host?: string;
    } & { [key: string]: any },
    _checkSubscription: boolean = true,
  ) {
    void _company_id;
    void _checkSubscription;
    companyName = companyName || process.env.SWAYAUTH_COMPANY_NAME;

    const html = await this.renderTemplate(template, {
      image: image || CONST.SWAYAUTH_LOGO,
      name: first_name,
      tokenType,
      token,
      amount,
      plan,
      time,
      companyName: companyName || process.env.SWAYAUTH_COMPANY_NAME,
      expire,
      domain: domain || process.env.SWAYAUTH_DOMAIN,
      location: location || process.env.SWAYAUTH_LOCATION,
      ...rest,
    });

    try {
      let res: { accepted: any[] } = { accepted: [] };
      from = `${fromName || companyName || process.env.SWAYAUTH_COMPANY_NAME} <${from || process.env.SWAYAUTH_SERVICE_EMAIL}>`;
      if (host && password && username) {
        res = await this.mailer({
          host: host,
          password: password,
          username: username,
        }).sendMail({
          from,
          to,
          subject,
          html,
        });
      } else {
        res = await this.sendAmazonEmail({
          from,
          to,
          subject,
          html,
        });
      }
      return { status: !!res?.accepted.length };
    } catch (error: any) {
      return { status: false };
    }
  }

  mailer({
    host,
    password,
    username,
  }: {
    host: string;
    username: string;
    password: string;
  }) {
    return nodemailer.createTransport({
      host,
      port: 465,
      secure: true,
      auth: {
        pass: password,
        user: username,
      },
    });
  }

  sendAmazonEmail({
    from,
    to,
    subject,
    html,
  }: {
    from: string;
    to: string;
    subject: string;
    html: string;
  }): Promise<{ accepted: any[] }> {
    return new Promise((resolve, reject) => {
      const sendEmailCommand = new SendEmailCommand({
        Destination: {
          CcAddresses: [],
          ToAddresses: [to],
        },
        Message: {
          Body: {
            Html: { Charset: 'UTF-8', Data: html },
          },
          Subject: { Charset: 'UTF-8', Data: subject },
        },
        Source: from,
        ReplyToAddresses: [],
      });
      sesClient
        .send(sendEmailCommand)
        .then(() => resolve({ accepted: [1] }))
        .catch((err) => reject(err));
    });
  }

  sendEmailApi({
    html,
    from,
    to,
    subject,
    name,
    toName,
  }: {
    html: string;
    from: string;
    to: string;
    subject: string;
    name: string;
    toName: string;
  }): Promise<{ accepted: any[] }> {
    const emailClient = new SendMailClient({
      url: 'api.zeptomail.com/',
      token: process.env.ZEPTO_TOKEN,
    });
    return new Promise((resolve, reject) => {
      emailClient
        .sendMail({
          from: {
            address: from,
            name,
          },
          to: [
            {
              email_address: {
                address: to,
                name: toName || '',
              },
            },
          ],
          subject,
          htmlbody: html,
        })
        .then(() => resolve({ accepted: [1] }))
        .catch((err: any) => reject(err));
    });
  }

  async sendPasswordReset(params: {
    to: string;
    reset_token: string;
    user_name: string;
    reset_url: string;
  }) {
    return this.sendMail({
      to: params.to,
      subject: 'Password Reset Request',
      template: 'reset-password',
      token: params.reset_token,
      first_name: params.user_name,
      company_id: process.env.SWAYAUTH_COMPANY_ID || '',
      domain: process.env.FRONTEND_URL || '',
      expire: '15 minutes',
      host: process.env.SMTP_HOST || '',
      password: process.env.SMTP_PASSWORD || '',
      username: process.env.SMTP_USERNAME || '',
    });
  }

  async renderTemplate(templatePath: string, data: { [key: string]: any }) {
    let renderedTemplate = '';
    const candidates = [
      path.join(__dirname, '../../templates', templatePath + '.hbs'),
      path.join(__dirname, '../templates', templatePath + '.hbs'),
      path.join(process.cwd(), 'dist', 'templates', templatePath + '.hbs'),
      path.join(process.cwd(), 'src', 'templates', templatePath + '.hbs'),
    ];
    const viewDir = candidates.find((p) => fs.existsSync(p)) as string;
    const templateContent = fs.readFileSync(viewDir, { encoding: 'utf-8' });
    const templateCompiled = handlebars.compile(templateContent);
    renderedTemplate = templateCompiled({
      ...data,
      year: new Date().getFullYear(),
    });

    return renderedTemplate.replaceAll('\n', '');
  }

  async allowEmail(company_id: string): Promise<boolean> {
    const { sub, expired } = await this.isSubExpired(company_id);
    if (expired) return false;

    const mailCount = await this.prisma.mail.count({
      where: {
        company_id,
        created_at: {
          gte: sub.created_at,
          lte: new Date(),
        },
      },
    });

    const isCompanyEmail = await this.prisma.serviceMail.findFirst({
      where: {
        company_id,
        verified: true,
      },
    });
    const socialCount = CONST.SUBSCRIPTION[sub.subscription];

    if (isCompanyEmail && mailCount >= socialCount.client_email) return false;
    if (mailCount >= socialCount.sway_email) return false;
    return true;
  }

  async isSubExpired(
    company_id: string,
  ): Promise<{ sub: Subscription; expired: boolean }> {
    const sub = await this.prisma.subscription.findFirst({
      where: {
        company_id,
      },
      orderBy: {
        id: 'desc',
      },
    });

    if (!sub) return { expired: true, sub };
    const subDate = new Date(sub.created_at);
    const currentDay = new Date();
    if (currentDay.getMonth() > subDate.getMonth())
      return { expired: true, sub };
    if (currentDay.getDate() > subDate.getDate() + 30)
      return { expired: true, sub };
    return { expired: false, sub };
  }
}
