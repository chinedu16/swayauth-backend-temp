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
import { JWTProp } from 'src/auth/type';
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
import { SubscriptionService } from '../subscription/subscription.service';
import { ClientIdDto } from './dto/facebook.dto';
import {
  FacebookCodeResponseProp,
  FacebookDebugToken,
  FacebookMeData,
  FacebookTokenResponseProp,
  StateProps,
} from './type/facebook.type';

@Injectable()
export class FacebookService {
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
      if (stateDecrypted?.duration < Date.now())
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
          data: { facebook: null, website: null },
        });

      if (!orgToken.scope.includes('facebook'))
        throw new UnauthorizedException({
          message: 'Facebook authentication failed',
          data: {
            facebook: null,
            website: orgToken?.organization?.website || null,
          },
        });

      stateObj = {
        user_type: 'user',
        redirect_url: orgToken.redirect_url,
        origins: orgToken.origins,
        organization_id: orgToken.organization_id,
        organization_token_id: orgToken.id,
      };

      // const allowFacebook = await this.subscription.allowSocial(orgToken.company_id)

      // if (!allowFacebook) throw new BadRequestException('Subscription service has expired or exceeded facebook usage limit');
    }

    const state = Encrypt(JSON.stringify(stateObj));

    return { facebook: this.buildFacebookUrl(state), website: null };
  }

  async getBasicInfo(params: FacebookCodeResponseProp) {
    const redirect_uri = CONST.REDIRECT_URI_FACEBOOK;
    const client_id = process.env.FACEBOOK_APP_ID;
    const client_secret = process.env.FACEBOOK_APP_SECRET;
    const client_token = process.env.FACEBOOK_APP_TOKEN;
    const stateJson: StateProps = JSON.parse(Decrypt(params?.state));
    if (params?.code) {
      const urlPath = `https://graph.facebook.com/v18.0/oauth/access_token?code=${params.code}&client_id=${client_id}&client_secret=${client_secret}&redirect_uri=${redirect_uri}`;
      try {
        const token: FacebookTokenResponseProp = (await axios.post(urlPath))
          .data;
        const userDataPath = `https://graph.facebook.com/debug_token?input_token=${token.access_token}&access_token=${client_token}`;
        const userData: FacebookDebugToken = (await axios.get(userDataPath))
          .data?.data;
        const mePath = `https://graph.facebook.com/${userData.user_id}?fields=id,email,last_name,first_name,picture.type(large)&access_token=${token.access_token}`;
        const meData: FacebookMeData = (await axios.get(mePath)).data;
        const email = meData.email;
        const photo = meData.picture.data.url;
        const user_type = stateJson.user_type;
        const organization_id = stateJson.organization_id;
        const first_name = meData.first_name;
        const last_name = meData.last_name;
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

        await this.prisma.facebook.create({
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

  buildFacebookUrl(state: string) {
    const url = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}`;
    const state_data = `&state=${state}`;
    const scope = `&scope=email,public_profile`;
    const redirect_uri = `&redirect_uri=${CONST.BASE_URL}v1/facebook/response`;
    return `${url}${state_data}${scope}${redirect_uri}`;
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
