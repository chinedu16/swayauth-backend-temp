import { Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import crypto from 'crypto';
import { Request } from 'express';
import { CONST, SingleTransaction } from 'src/common';
import { reportErrorToSlack } from 'src/common/util/slack';
import { MailService } from 'src/mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller({ version: '1', path: 'payment' })
export class PaymentController {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  @Post('hook')
  @HttpCode(HttpStatus.OK)
  async paymentHook(@Req() req: Request) {
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY as string)
      .update(JSON.stringify(req.body))
      .digest('hex');
    if (hash === req.headers['x-paystack-signature']) {
      console.log(req.body?.data);
      try {
        const transaction: SingleTransaction = req.body?.data;
        const email = transaction.customer.email;
        const transactionType = transaction.metadata?.transaction_type;
        const amount = Number(transaction.amount) / 100;

        const transactionData = {
          amount,
          type: 'wallet',
          purpose: transaction?.metadata.purpose,
          status: transaction.status,
          reference: transaction.reference,
          company_id: transaction?.metadata.company_id,
        };

        const oldTransaction = await this.prisma.transaction.findFirst({
          where: {
            reference: transaction.reference,
          },
        });

        if (oldTransaction) {
          await this.prisma.transaction.update({
            where: {
              reference: transaction.reference,
            },
            data: transactionData,
          });
        } else {
          await this.prisma.transaction.create({
            data: transactionData,
          });
        }

        if (
          transaction.status === 'success' &&
          (!oldTransaction || oldTransaction?.status != 'success')
        ) {
          const card = transaction.authorization;
          if (
            card?.reusable &&
            card?.channel == 'card' &&
            transaction?.metadata.save_card == 'true'
          ) {
            const cardDetail = {
              authorization_code: card.authorization_code,
              bank: card.bank,
              country_code: card.country_code,
              exp_month: card.exp_month,
              exp_year: card.exp_year,
              signature: card.signature,
              account_name: card.account_name,
              card_type: card.card_type,
              first_6digit: card.bin,
              last_4digit: card.last4,
              company_email: email,
            };

            await this.prisma.card.upsert({
              where: {
                signature: card.signature,
              },
              create: cardDetail,
              update: cardDetail,
            });
          }

          if (transactionType === 'wallet') {
            const company = await this.prisma.company.update({
              where: {
                email,
              },
              data: {
                wallet: {
                  update: {
                    amount: {
                      increment: amount,
                    },
                  },
                },
              },
            });

            await this.prisma.mail.create({
              data: {
                company_id: company?.id,
                purpose: 'payment',
              },
            });

            await this.mail.sendMail(
              {
                to: email,
                amount: amount,
                company_id: company.id,
                first_name: company.name,
                subject: 'Wallet Topup',
                template: 'wallet',
              },
              false,
            );
          } else if (
            transactionType === 'subscription' &&
            transaction.metadata.subscription_type
          ) {
            const metadata = transaction.metadata;
            const subPrice =
              CONST.SUBSCRIPTION.price[metadata.subscription_type];
            if (subPrice > amount) {
              //reduce wallet price
              await this.prisma.company.update({
                where: {
                  id: metadata.company_id,
                },
                data: {
                  wallet: {
                    update: {
                      amount: {
                        decrement: subPrice - amount,
                      },
                    },
                  },
                },
              });
            }

            await this.prisma.subscription.create({
              data: {
                subscription: metadata.subscription_type,
                amount: subPrice,
                company_id: metadata.company_id,
              },
            });

            await this.mail.sendMail(
              {
                to: email,
                subject: 'Subscription Service Renewed',
                template: 'subscription-renewal',
                plan: metadata.subscription_type,
                amount: subPrice,
                fromName: 'Swayauth',
                company_id: metadata.company_id,
                companyName: metadata.company_name,
              },
              false,
            );
          }
        }
      } catch (error: any) {
        reportErrorToSlack(error);
      }
    }
    return 'OK';
  }
}
