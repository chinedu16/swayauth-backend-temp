import { BadRequestException, Injectable } from '@nestjs/common';
import { Company, Subscription } from '@prisma/client';
import { JWTProp } from 'src/auth/type';
import { CONST } from 'src/common';
import { MailService } from 'src/mail/mail.service';
import { PaymentService } from 'src/payment/payment.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { NewsLetter, PaymentMethod, SubscriptionDto } from './subscription.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class SubscriptionService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private paymentService: PaymentService,
  ) {}

  async getSubscription(company: Company) {
    return this.prisma.subscription.findFirst({
      where: {
        company_id: company.id,
      },
      orderBy: {
        id: 'desc',
      },
    });
  }

  async newsLetter(dto: NewsLetter, ip_address: string) {
    try {
      await this.prisma.newsletter.create({
        data: { ...dto, ip_address },
      });
    } catch (error: any) {
      throw new BadRequestException('Email already exist');
    }
    return { message: 'Subscription was successfully' };
  }

  async createSubscription(jwt: JWTProp, dto: SubscriptionDto) {
    const amount = CONST.SUBSCRIPTION.price[dto.plan];

    const company = await this.prisma.company.findFirst({
      where: {
        id: jwt.company_id,
      },
      include: {
        wallet: true,
        card: {
          take: 1,
          orderBy: { id: 'desc' },
        },
      },
    });

    if (dto.payWith == PaymentMethod.wallet) {
      if (amount > company.wallet.amount)
        throw new BadRequestException('Insufficient fund');

      await this.prisma.company.update({
        where: {
          id: jwt.company_id,
        },
        data: {
          wallet: {
            update: {
              amount: {
                decrement: amount,
              },
            },
          },
        },
      });

      await this.prisma.subscription.create({
        data: {
          subscription: dto.plan,
          amount,
          company_id: jwt.company_id,
        },
      });

      await this.prisma.transaction.create({
        data: {
          amount,
          type: 'wallet',
          purpose: `${dto.plan} subscription service`,
          status: 'success',
          reference: randomUUID().substring(0, 12),
          company_id: jwt.company_id,
        },
      });

      await this.mail.sendMail(
        {
          to: jwt.email,
          subject: 'Subscription Service Renewed',
          template: 'subscription-renewal',
          plan: dto.plan,
          fromName: process.env.SWAYAUTH_COMPANY_NAME,
          amount,
          company_id: jwt.company_id,
        },
        false,
      );

      return { message: 'Subscription service was successful' };
    } else if (dto.payWith == PaymentMethod.card) {
      if (!company.card.length) throw new BadRequestException();
      const card = company.card?.[0];
      await this.paymentService.chargeSavedCard({
        authorization_code: card?.authorization_code,
        email: jwt.email,
        amount,
        metadata: {
          transaction_type: 'subscription',
          company_id: jwt.company_id,
          subscription_type: dto.plan,
          company_name: company.name,
          purpose: `${dto.plan} subscription service`,
          save_card: 'false',
        },
      });
      return { message: 'Subscription service renewal is processing' };
    } else {
      return await this.paymentService.generateAccessCode({
        email: company.email,
        amount: amount,
        metadata: {
          transaction_type: 'subscription',
          company_id: jwt.company_id,
          subscription_type: dto.plan,
          company_name: company.name,
          purpose: `${dto.plan} subscription service`,
          save_card: 'false',
        },
      });
    }
  }

  async autoSubscriptionCronJob() {
    try {
      const oneDay = 1000 * 60 * 60 * 24;
      const thirtyOneDaysAgo = new Date(Date.now() - oneDay * 31);
      const thirtyDaysAgo = new Date(Date.now() - oneDay * 30);
      const threedaysToExpire = {
        gte: new Date(Date.now() - oneDay * (31 + 4)),
        lte: new Date(Date.now() - oneDay * (31 + 3)),
      };

      const expiredCompanySubs = await this.prisma.company.findMany({
        where: {
          subscription: {
            some: {
              created_at: {
                gte: thirtyOneDaysAgo,
                lte: thirtyDaysAgo,
              },
            },
          },
        },
        orderBy: {
          id: 'desc',
        },
        include: {
          subscription: {
            take: 1,
            orderBy: {
              id: 'desc',
            },
          },
          wallet: true,
          card: {
            take: 1,
            orderBy: {
              id: 'desc',
            },
          },
        },
      });

      const aboutToExpSubs = await this.prisma.company.findMany({
        where: {
          subscription: {
            some: {
              created_at: threedaysToExpire,
            },
          },
        },
        include: {
          subscription: {
            take: 1,
            orderBy: {
              id: 'desc',
            },
          },
        },
      });

      if (expiredCompanySubs?.length) {
        for (let m = 0; m < expiredCompanySubs.length; m++) {
          const {
            card,
            name,
            email,
            id,
            wallet,
            subscription: sub,
          } = expiredCompanySubs[m];
          let subscription = sub[0].subscription;
          if (subscription == 'free') subscription = 'standard';
          let subPrice = CONST.SUBSCRIPTION.price[subscription];
          if (wallet.amount) {
            if (wallet.amount >= subPrice) {
              //remove subscription price - reduce wallet here, sub and send email
              await this.prisma.company.update({
                where: {
                  id,
                },
                data: {
                  wallet: {
                    update: {
                      amount: {
                        decrement: subPrice,
                      },
                    },
                  },
                },
              });

              await this.prisma.subscription.create({
                data: {
                  subscription,
                  amount: subPrice,
                  company_id: id,
                },
              });

              await this.mail.sendMail(
                {
                  to: email,
                  subject: 'Subscription Service Was Renewed',
                  template: 'subscription-renewal',
                  plan: subscription,
                  amount: subPrice,
                  company_id: id,
                  companyName: name,
                },
                false,
              );
            } else {
              subPrice = subPrice - wallet.amount;
              // add metadata to turn wallet to zero or deduction here on paystack
              if (card?.length) {
                //charge card here and add wallet deduction here
                await this.paymentService.chargeSavedCard({
                  authorization_code: card?.[0]?.authorization_code,
                  email: email,
                  amount: subPrice,
                  metadata: {
                    transaction_type: 'subscription',
                    company_id: id,
                    subscription_type: subscription,
                    company_name: name,
                    purpose: `${subscription} subscription service`,
                    save_card: 'false',
                  },
                });
              } else {
                await this.mail.sendMail(
                  {
                    to: email,
                    subject: 'Subscription Service Failed',
                    template: 'subscription-failed',
                    companyName: name,
                    company_id: id,
                  },
                  false,
                );
              }
            }
          }
        }
      }

      if (aboutToExpSubs?.length) {
        for (let i = 0; i < aboutToExpSubs.length; i++) {
          //send them renewal notice
          await this.mail.sendMail(
            {
              to: aboutToExpSubs[i].email,
              subject: 'You subscription plan is about to expire!',
              template: 'subscription-expires',
              plan: aboutToExpSubs[i].subscription[0].subscription,
              company_id: aboutToExpSubs[i].id,
              amount: aboutToExpSubs[i].subscription[0].amount,
              companyName: aboutToExpSubs[i].name,
            },
            false,
          );
        }
      }
    } catch (error: any) {
      console.error(error);
    }
  }

  async allowUserRegistration(company_id: string): Promise<boolean> {
    const { sub, expired } = await this.isSubExpired(company_id);
    if (expired) return false;

    const regUserCount = await this.prisma.user.count({
      where: {
        company_id,
      },
    });
    const subCriterial = CONST.SUBSCRIPTION[sub.subscription];
    if (regUserCount >= subCriterial.customers) return false;
    return true;
  }

  async allowOrganizationCreate(company_id: string): Promise<boolean> {
    const { sub, expired } = await this.isSubExpired(company_id);
    if (expired) return false;

    const orgCount = await this.prisma.organization.count({
      where: {
        company_id,
      },
    });

    const subCriterial = CONST.SUBSCRIPTION[sub.subscription];
    if (orgCount >= subCriterial.organizations) return false;
    return true;
  }

  async allowOrganizationTokenCreate(company_id: string): Promise<boolean> {
    const { sub, expired } = await this.isSubExpired(company_id);
    if (expired) return false;

    const orgTokenCount = await this.prisma.organizationToken.count({
      where: {
        company_id,
      },
    });
    const subCriterial = CONST.SUBSCRIPTION[sub.subscription];
    if (orgTokenCount >= subCriterial.organization_tokens) return false;
    return true;
  }

  async allowTeamCreate(company_id: string): Promise<boolean> {
    const { sub, expired } = await this.isSubExpired(company_id);
    if (expired) return false;

    const teamCount = await this.prisma.association.count({
      where: {
        company_id,
      },
    });

    const subCriterial = CONST.SUBSCRIPTION[sub.subscription];
    if (teamCount >= subCriterial.organizations) return false;
    return true;
  }

  async allow2fa(company_id: string): Promise<boolean> {
    const { sub, expired } = await this.isSubExpired(company_id);
    if (expired) return false;
    return CONST.SUBSCRIPTION[sub.subscription].two_factor;
  }

  async allowSocial(company_id: string): Promise<boolean> {
    const { sub, expired } = await this.isSubExpired(company_id);
    if (expired) return false;

    const facebookCount = await this.prisma.facebook.count({
      where: {
        company_id,
        created_at: {
          gte: sub.created_at,
          lte: new Date(),
        },
      },
    });

    const googleCount = await this.prisma.google.count({
      where: {
        company_id,
        created_at: {
          gte: sub.created_at,
          lte: new Date(),
        },
      },
    });

    const total = facebookCount + googleCount;

    const socialCount = CONST.SUBSCRIPTION[sub.subscription];
    if (total >= socialCount.social) return false;
    return true;
  }

  async allowSMS(company_id: string): Promise<boolean> {
    const { sub, expired } = await this.isSubExpired(company_id);
    if (expired) return false;

    const smsCount = await this.prisma.sms.count({
      where: {
        company_id,
        created_at: {
          gte: sub.created_at,
          lte: new Date(),
        },
      },
    });

    const socialCount = CONST.SUBSCRIPTION[sub.subscription];
    if (smsCount >= socialCount.sms) return false;
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
    const days = sub.subscription == 'free' ? 14 : 30;
    const subDate = new Date(sub.created_at);
    if (subDate.getTime() + 1000 * 60 * 60 * 24 * days < Date.now())
      return { expired: true, sub };
    return { expired: false, sub };
  }
}
