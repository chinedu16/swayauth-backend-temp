import {
  GatewayTimeoutException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  Client,
  Company,
  Organization,
  Prisma,
  ServiceMail,
  User,
} from '@prisma/client';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { JWTProp } from '../auth/type';
import {
  CONST,
  Decrypt,
  Encrypt,
  GenerateToken,
  generateAppKey,
  verifyUserAuthorization,
} from '../common';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClientIdDto } from './dto/google.dto';
import {
  GoogleCodeResponseProp,
  GooglePhoneResponseProp,
  GoogleTokenResponseProp,
  JwtDecode,
  StateProps,
} from './type/google.type';
import { SubscriptionService } from '../subscription/subscription.service';

@Injectable()
export class GoogleService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private subscription: SubscriptionService,
    private mail: MailService,
  ) {}

  async authentication(params: ClientIdDto) {
    let stateObj: StateProps = {
      user_type: 'client',
      redirect_url: '',
      origins: ['https://swayauth.com'],
      organization_id: '',
      organization_token_id: '',
    };

    try {
      const stateDecrypted = JSON.parse(
        Decrypt(params.client_id, process.env.SWAYAUTH_IDENTITY as string),
      ) as { url: string; duration: number };
      if (stateDecrypted.duration < Date.now())
        throw new UnauthorizedException('expired');
      stateObj.redirect_url = CONST.CLIENT_APP_URL + '/verify';
    } catch (error: any) {
      if (error?.message == 'expired') throw new GatewayTimeoutException();
      const orgToken = await this.prisma.organizationToken.findFirst({
        where: { id: params.client_id },
        include: {
          organization: {
            select: {
              website: true,
            },
          },
        },
      });

      if (!orgToken)
        throw new NotFoundException({
          message: 'Organization token not found',
          data: { google: null, website: null },
        });

      if (!orgToken.scope.includes('google'))
        throw new UnauthorizedException({
          message: 'Google authentication failed',
          data: {
            google: null,
            website: orgToken?.organization?.website || null,
          },
        });

      stateObj = {
        user_type: 'user',
        origins: orgToken.origins,
        redirect_url: orgToken.redirect_url,
        organization_id: orgToken.organization_id,
        organization_token_id: orgToken.id,
      };

      // const allowGoogle = await this.subscription.allowSocial(orgToken.company_id)

      // if (!allowGoogle) throw new BadRequestException('Subscription service has expired or exceeded google usage limit');
    }

    const state = Encrypt(JSON.stringify(stateObj));

    return { google: this.buildGoogleUrl(state) };
  }

  async getBasicInfo(params: GoogleCodeResponseProp) {
    const people_base_url = `https://people.googleapis.com/v1/people/me?personFields=phoneNumbers`;
    const redirect_uri = CONST.REDIRECT_URI_GOOGLE;
    const client_id = process.env.GOOGLE_CLIENT_ID;
    const client_secret = process.env.GOOGLE_CLIENT_SECRET;
    const stateJson: StateProps = JSON.parse(Decrypt(params?.state));
    if (params?.code) {
      const urlPath = `https://oauth2.googleapis.com/token?code=${params.code}&client_id=${client_id}&client_secret=${client_secret}&grant_type=authorization_code&redirect_uri=${redirect_uri}`;
      try {
        const token: GoogleTokenResponseProp = (await axios.post(urlPath)).data;
        const jwt = jwtDecode<JwtDecode>(token.id_token);
        const email = jwt.email;
        const photo = jwt.picture;
        const user_type = stateJson.user_type;
        const organization_id = stateJson.organization_id;
        const first_name = jwt.given_name;
        const last_name = jwt.family_name;
        type userType = User & { organization: Organization } & {
          company: Company & { service_email: ServiceMail[] };
        };
        type clientType = Client &
          Partial<{ organization: Organization }> & {
            association: {
              creator: boolean;
              company: Company & { service_email: ServiceMail[] };
            }[];
            company: Company & { service_email: ServiceMail[] };
          };
        let userExist: userType | clientType;
        if (user_type == 'user') {
          userExist = await (
            this.prisma[user_type] as Prisma.UserDelegate
          ).findFirst({
            where: {
              email,
              organization_id,
            },
            include: {
              company: {
                include: {
                  service_email: {
                    take: 1,
                    orderBy: {
                      id: 'desc',
                    },
                  },
                },
              },
              organization: true,
            },
          });
        } else {
          userExist = await (
            this.prisma[user_type] as Prisma.ClientDelegate
          ).findFirst({
            where: {
              email,
            },
            include: {
              company: {
                include: {
                  service_email: {
                    take: 1,
                    orderBy: {
                      id: 'desc',
                    },
                  },
                },
              },
              association: {
                select: {
                  creator: true,
                  company: {
                    where: {
                      status: 'active',
                    },
                    include: {
                      service_email: {
                        take: 1,
                        orderBy: {
                          id: 'desc',
                        },
                      },
                    },
                  },
                },
                orderBy: {
                  creator: 'asc',
                },
                take: 1,
              },
            },
          });
        }
        let purpose: 'login' | 'register' = 'login';
        if (userExist) {
          await verifyUserAuthorization(userExist);
          if (user_type == 'user' && !(userExist as userType)?.organization)
            throw new NotFoundException('Account does not exist');
        } else {
          const phoneData: GooglePhoneResponseProp = (
            await axios.get(people_base_url, {
              headers: { Authorization: `Bearer ${token.access_token}` },
            })
          ).data;
          const phone = phoneData?.phoneNumbers?.[0].value || '';
          purpose = 'register';
          if (user_type == 'user') {
            //save user
            const organization = await this.prisma.organization.findFirst({
              where: {
                id: stateJson.organization_id,
              },
              include: {
                company: {
                  include: {
                    service_email: {
                      take: 1,
                      orderBy: {
                        id: 'desc',
                      },
                    },
                  },
                },
              },
            });

            if (organization?.company?.status !== 'active')
              throw new NotFoundException('Organization does not exist');

            const userData = {
              first_name,
              last_name,
              email,
              phone,
              photo,
              organization_token_id: stateJson.organization_token_id,
              verified: true,
              organization_id: stateJson.organization_id,
              company_id: organization?.company?.id,
            } as User;

            userExist = await this.prisma.user.create({
              data: userData,
              include: {
                company: {
                  include: {
                    service_email: {
                      take: 1,
                      orderBy: {
                        id: 'desc',
                      },
                    },
                  },
                },
                organization: true,
              },
            });
          } else {
            //save client
            const app_key = generateAppKey(email);
            const wallet = await this.prisma.wallet.create({ data: {} });
            const appKey = await this.prisma.appKey.create({
              data: { key: app_key },
            });
            const company = await this.prisma.company.create({
              data: {
                email: email,
                name: first_name,
                wallet_id: wallet.id as never,
                app_key_id: appKey.id as never,
              },
            });

            await this.prisma.association.create({
              data: {
                creator: true,
                permissions: ['read', 'write', 'delete'],
                access: 'level_3',
                company_id: company.id,
                client_email: email,
              },
            });

            userExist = await this.prisma.client.create({
              data: {
                first_name,
                last_name,
                phone,
                verified: true,
                email,
                photo,
                company_id: company.id,
              },
              include: {
                company: {
                  include: {
                    service_email: {
                      take: 1,
                      orderBy: {
                        id: 'desc',
                      },
                    },
                  },
                },
                association: {
                  select: {
                    creator: true,
                    company: {
                      where: {
                        status: 'active',
                      },
                      include: {
                        service_email: {
                          take: 1,
                          orderBy: {
                            id: 'desc',
                          },
                        },
                      },
                    },
                  },
                  orderBy: {
                    creator: 'asc',
                  },
                  take: 1,
                },
              },
            });
          }

          this.mail.sendMail(
            {
              to: email,
              companyName:
                user_type == 'client'
                  ? process.env.SWAYAUTH_COMPANY_NAME
                  : userExist?.organization?.name ||
                    userExist?.company?.service_email?.[0]?.company_name ||
                    userExist?.company?.name,
              first_name,
              company_id: userExist.company_id,
              subject: 'Thank you for registering!',
              template: 'social-register',
              from: userExist?.company?.service_email?.[0]?.email,
              username: userExist?.company?.service_email?.[0]?.username,
              password: Decrypt(
                userExist?.company?.service_email?.[0]?.password,
              ),
              host: userExist?.company?.service_email?.[0]?.host,
              domain: (userExist as userType)?.organization?.website,
              image:
                userExist?.organization?.photo ||
                userExist?.company?.service_email?.[0]?.photo,
              location: userExist?.company?.address,
            },
            false,
          );
        }

        await this.prisma.google.create({
          data: {
            [user_type == 'user' ? 'user_id' : 'client_id']: userExist.id,
            company_id: userExist.company_id,
            purpose,
          },
        });

        let access_token: string, refresh_token: string;
        if (user_type == 'user') {
          access_token = await this.token(userExist as userType, '48h');
          refresh_token = await this.token(userExist as userType, '90d');
        } else {
          const company =
            userExist?.company?.status === 'active'
              ? userExist.company
              : (userExist as clientType)?.association[0]?.company;
          const association = await this.prisma.association.findFirst({
            where: {
              company_id: company.id,
            },
          });
          const tokenGen: GenerateToken = {
            id: userExist.id,
            access: association.access,
            company_id: company.id,
            email: userExist.email,
            permissions: association.permissions,
            scope: userExist.scope,
            status: userExist.status,
            two_factor_type: userExist.two_factor_type,
          };
          access_token = await this.token(tokenGen, '48h');
          refresh_token = await this.token(tokenGen, '90d');
        }

        if (!stateJson.redirect_url && !stateJson.origins?.length) {
          access_token = '';
          refresh_token = '';
        }

        return `${stateJson.redirect_url || CONST.CLIENT_APP_URL + '/social'}?intent=login&status=${Boolean(stateJson.redirect_url || stateJson.origins?.length)}&message=${access_token ? 'OK' : 'Invalid token setup'}&access_token=${access_token}&refresh_token=${refresh_token}${stateJson.redirect_url ? '' : `&origins=${stateJson.origins?.join(',')}`}`;
      } catch (error: any) {
        return `${stateJson.redirect_url || CONST.CLIENT_APP_URL + '/social'}?intent=login&status=${false}&message=${error.message}&access_token=&refresh_token=`;
      }
    } else {
      return `${stateJson.redirect_url || CONST.CLIENT_APP_URL + '/social'}?intent=login&status=${false}&message=${params.error}&access_token=&refresh_token=`;
    }
  }

  buildGoogleUrl(state: string) {
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?';
    const scope =
      `scope=https://www.googleapis.com/auth/userinfo.email` +
      ` https://www.googleapis.com/auth/userinfo.profile` +
      ` https://www.googleapis.com/auth/user.phonenumbers.read`;
    const response_type = '&response_type=code';
    const state_data = `&state=${state}`;
    const redirect_uri = `&redirect_uri=${CONST.BASE_URL}v1/google/response`;
    const client_id = `&client_id=${process.env.GOOGLE_CLIENT_ID}`;
    return `${url}${scope}${response_type}${state_data}${redirect_uri}${client_id}`;
  }

  async token(
    user: GenerateToken,
    duration: `${number}d` | `${number}h` | `${number}m`,
  ): Promise<string> {
    return await this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        scope: user.scope,
        two_factor_type: user.two_factor_type,
        permissions: user.permissions,
        status: user.status,
        company_id: user.company_id,
        organization_token_id: user?.organization_token_id,
        organization_id: user?.organization_id,
        access: user.access,
      } as JWTProp,
      { expiresIn: duration },
    );
  }
}
