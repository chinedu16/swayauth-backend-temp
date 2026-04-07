import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  Admin,
  AuthorizationToken,
  Client,
  Company,
  Organization,
  OrganizationToken,
  Prisma,
  ServiceMail,
  User,
} from '@prisma/client';
import * as argon from 'argon2';
import {
  Decrypt,
  GenerateToken,
  GenericResponse,
  createReference,
  expireIn,
  gen6digit,
  generateAppKey,
  generateTotp,
  verifyReference,
  verifyTotp,
  verifyUserAuthorization,
} from '../common';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { SubscriptionService } from '../subscription/subscription.service';
import {
  ChangePasswordDto,
  ForgetPasswordDto,
  LoginDto,
  RegisterClientDto,
  RegisterDto,
  TotpBaseDto,
  TotpDto,
  TotpEnableDto,
} from './dto';
import { LoginResponse } from './type';
import { JWTProp } from './type/jwt.type';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
    private sms: SmsService,
    private subscription: SubscriptionService,
  ) {}

  async loginUser(
    dto: LoginDto,
    orgToken: OrganizationToken,
    ip_address: string,
  ): Promise<LoginResponse> {
    let user: User & { organization: Organization } & {
      company: Company & { service_email: ServiceMail[] };
    };
    try {
      user = await this.prisma.user.findFirst({
        where: {
          email: dto.email,
          organization_id: orgToken.organization_id,
          status: 'active',
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
    } catch (error: any) {
      throw new NotFoundException('Account does not exist');
    }

    await verifyUserAuthorization(user);

    if (!user.organization)
      throw new NotFoundException('Account does not exist');
    else if (!user.password)
      throw new ForbiddenException(
        'Manual login is not available for this account',
      );

    if (!(await argon.verify(user.password, dto.password)))
      throw new UnauthorizedException('Invalid password');

    if (
      user.two_factor_type &&
      !orgToken.two_factor_type.includes(user.two_factor_type)
    )
      throw new UnauthorizedException(
        'Two-factor authentication is not available, please contact our customer support',
      );

    if (ip_address?.length > 12)
      await this.prisma.user.update({
        where: { id: user.id },
        data: { ip_address },
      });
    await this.prisma.manual.create({
      data: {
        user_id: user.id,
        company_id: user.company_id,
        ip_address,
        purpose: 'login',
      },
    });
    const time = expireIn(15);
    const token = gen6digit().toString();
    const reference = createReference(user.id, 15, 'login', { token });

    if (user.scope.includes('two_factor') && user.two_factor_type) {
      const twoFactorType = user.two_factor_type;
      if (twoFactorType === 'mail') {
        await this.mail.sendMail({
          to: user.email,
          subject: 'Login Authentication',
          template: 'login',
          token,
          tokenType: true,
          company_id: user.company_id,
          first_name: user.first_name,
          from: user?.company?.service_email?.[0]?.email,
          username: user?.company?.service_email?.[0]?.username,
          password: Decrypt(user?.company?.service_email?.[0]?.password),
          host: user?.company?.service_email?.[0]?.host,
          domain: user?.organization?.website,
          image:
            user?.organization?.photo ||
            user?.company?.service_email?.[0]?.photo,
          location: user?.organization?.address,
          companyName: user?.organization?.name,
        });
        await this.prisma.mail.create({
          data: {
            ['user_id']: user.id,
            company_id: user?.company?.id,
            purpose: 'login',
          },
        });
      } else if (twoFactorType === 'sms') {
        if (!user.phone)
          throw new UnauthorizedException('Login requires verification by sms');

        await this.sms.sendSMSToken({
          first_name: user.first_name,
          company_name: user.organization.name,
          phone: user.phone,
          company_id: user.company.id,
          token,
        });
        await this.prisma.sms.create({
          data: {
            ['user_id']: user.id,
            company_id: user?.company?.id,
            purpose: 'login',
          },
        });
      }

      await this.prisma.authorizationToken.create({
        data: {
          type: twoFactorType,
          expire_at: time,
          email: user.email,
          user_type: 'user',
          purpose: 'login',
          reference: reference,
          token: token,
          company_id: user.company_id,
        },
      });

      return {
        two_factor_enabled: true,
        reference: reference,
        two_factor_type:
          twoFactorType === 'mail' ? 'mail_token' : twoFactorType,
      };
    }

    const access_token = await this.token(user, '48h');
    const refresh_token = await this.token(user, '90d');
    return {
      access_token,
      refresh_token,
      two_factor_enabled: false,
      two_factor_type: user.two_factor_type,
    };
  }

  async loginAdmin(dto: LoginDto, ip_address: string): Promise<LoginResponse> {
    let admin: Admin;
    try {
      admin = await this.prisma.admin.update({
        where: { email: dto.email },
        data: { ip_address },
      });
    } catch (error: any) {
      throw new NotFoundException('Account does not exist');
    }

    if (admin?.status === 'disabled')
      throw new NotFoundException('Account does not exist');
    else if (!admin.verified || !admin.password)
      throw new ForbiddenException('Account is not verified');

    if (!(await argon.verify(admin.password, dto.password)))
      throw new UnauthorizedException('Invalid password');

    const time = expireIn(15);
    const token = gen6digit().toString();
    const reference = createReference(admin.id, 10, 'login', { token });

    if (admin.scope.includes('two_factor')) {
      const twoFactorType = admin.two_factor_type;
      if (twoFactorType === 'mail') {
        await this.mail.sendMail(
          {
            to: admin.email,
            subject: 'Login Authentication',
            template: 'login',
            token,
            tokenType: true,
            company_id: process.env.SWAYAUTH_COMPANY_NAME,
            first_name: admin.first_name,
          },
          false,
        );
      } else if (twoFactorType === 'sms') {
        if (!admin.phone)
          throw new UnauthorizedException('Login requires verification by sms');

        await this.sms.sendSMSToken(
          {
            first_name: admin.first_name,
            company_name: process.env.SWAYAUTH_COMPANY_NAME,
            phone: admin.phone,
            company_id: 'Swayauth',
            token,
          },
          false,
        );
      }

      await this.prisma.authorizationToken.create({
        data: {
          type: twoFactorType,
          expire_at: time,
          purpose: 'login',
          user_type: 'admin',
          reference: reference,
          token: token,
          email: admin.email,
        },
      });

      return {
        two_factor_enabled: true,
        reference: reference,
        two_factor_type:
          twoFactorType === 'mail' ? 'mail_token' : twoFactorType,
      };
    }

    const tokenGen: GenerateToken = {
      id: admin.id,
      access: admin.access,
      email: admin.email,
      permissions: admin.permissions,
      scope: admin.scope,
      company_id: 'Swayauth',
      status: admin.status,
      two_factor_type: admin.two_factor_type,
    };

    const access_token = await this.token(tokenGen, '48h');
    const refresh_token = await this.token(tokenGen, '90d');
    return {
      access_token,
      refresh_token,
      two_factor_enabled: false,
      two_factor_type: admin.two_factor_type,
    };
  }

  async loginClient(dto: LoginDto, ip_address: string): Promise<LoginResponse> {
    let client: Client & {
      association: {
        creator: boolean;
        company: Company & { service_email: ServiceMail[] };
      }[];
      company: Company & { service_email: ServiceMail[] };
    };
    try {
      client = await this.prisma.client.update({
        where: { email: dto.email, status: 'active' },
        data: { ip_address },
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
    } catch (error: any) {
      throw new NotFoundException('Account does not exist');
    }

    if (client?.status === 'disabled')
      throw new NotFoundException('Account does not exist');
    else if (client?.company?.status !== 'active' && !client.association.length)
      throw new NotFoundException('Account does not exist');
    else if (!client.verified)
      throw new ForbiddenException('Account is not verified');
    else if (!client.password)
      throw new ForbiddenException(
        'Manual login is unavailable for this account',
      );

    if (!(await argon.verify(client.password, dto.password)))
      throw new UnauthorizedException('Invalid password');

    const company =
      client?.company?.status === 'active'
        ? client.company
        : client?.association[0]?.company;

    await this.prisma.manual.create({
      data: {
        client_id: client.id,
        company_id: company.id,
        ip_address,
        purpose: 'login',
      },
    });

    const time = expireIn(15);
    const token = gen6digit().toString();
    const reference = createReference(client.id, 10, 'login', { token });

    if (client.scope.includes('two_factor')) {
      const twoFactorType = client.two_factor_type;
      if (twoFactorType === 'mail') {
        await this.mail.sendMail({
          to: client.email,
          subject: 'Login Authentication',
          template: 'login',
          token,
          tokenType: true,
          company_id: client.company_id,
          first_name: client.first_name,
        });
        await this.prisma.mail.create({
          data: {
            ['client_id']: client.id,
            company_id: client?.company?.id,
            purpose: 'login',
          },
        });
      } else if (twoFactorType === 'sms') {
        if (!client.phone)
          throw new UnauthorizedException('Login requires verification by sms');

        await this.sms.sendSMSToken({
          first_name: client.first_name,
          company_name: company.name,
          phone: client.phone,
          company_id: client.company_id,
          token,
        });
      }
      await this.prisma.sms.create({
        data: {
          ['client_id']: client.id,
          company_id: client?.company?.id,
          purpose: 'login',
        },
      });

      await this.prisma.authorizationToken.create({
        data: {
          type: twoFactorType,
          expire_at: time,
          purpose: 'login',
          user_type: 'client',
          reference: reference,
          token: token,
          email: client.email,
          company_id: company.id,
        },
      });

      return {
        two_factor_enabled: true,
        reference: reference,
        two_factor_type:
          twoFactorType === 'mail' ? 'mail_token' : twoFactorType,
      };
    }

    const association = await this.prisma.association.findFirst({
      where: {
        company_id: company.id,
      },
    });

    const tokenGen: GenerateToken = {
      id: client.id,
      access: association.access,
      company_id: company.id,
      email: client.email,
      permissions: association.permissions,
      scope: client.scope,
      status: client.status,
      two_factor_type: client.two_factor_type,
    };

    const access_token = await this.token(tokenGen, '48h');
    const refresh_token = await this.token(tokenGen, '90d');
    return {
      access_token,
      refresh_token,
      two_factor_enabled: false,
      two_factor_type: client.two_factor_type,
    };
  }

  async forgotUserPassword(
    dto: ForgetPasswordDto,
    orgToken: OrganizationToken,
  ): Promise<GenericResponse> {
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        organization_id: orgToken.organization_id,
        status: 'active',
      },
      include: {
        company: {
          include: {
            service_email: true,
          },
        },
        organization: true,
      },
    });

    if (!user) throw new NotFoundException();

    if (!orgToken.scope.includes('mail'))
      throw new UnauthorizedException(
        'Organization does not allow email verification',
      );
    if (!user?.organization)
      throw new NotFoundException('Unable to perform request');
    if (user.status === 'disabled' || user?.company?.status !== 'active')
      throw new NotFoundException('Unable to perform request');

    const time = expireIn(60);
    const token = gen6digit().toString();
    const reference = createReference(user.id, 60, 'forgot-password', {
      token,
    });
    const link =
      orgToken.redirect_url +
      `?token=${token}&reference=${reference}&intent=forgot-password`;

    const tokenType = !orgToken?.redirect_url;

    let mailObject: Parameters<typeof this.mail.sendMail>[number] = {
      to: user.email,
      subject: 'Account recovery',
      template: 'forgot-password',
      token: tokenType ? token : link,
      tokenType,
      company_id: user.company_id,
      first_name: user.first_name,
      domain: user?.organization?.website,
      image:
        user?.organization?.photo || user?.company?.service_email?.[0]?.photo,
      location: user?.organization?.address,
      companyName: user?.organization.name,
      time: '1 hour',
    };

    if (user?.company?.service_email?.[0]?.verified) {
      mailObject = {
        ...mailObject,
        from: user?.company?.service_email?.[0]?.email,
        username: user?.company?.service_email?.[0]?.username,
        password: Decrypt(user?.company?.service_email?.[0]?.password),
        host: user?.company?.service_email?.[0]?.host,
        image:
          user?.organization.photo || user?.company?.service_email?.[0]?.photo,
      };
    }

    await this.mail.sendMail(mailObject);

    await this.prisma.mail.create({
      data: {
        ['user_id']: user.id,
        company_id: user?.company?.id,
        purpose: 'password',
      },
    });

    await this.prisma.authorizationToken.create({
      data: {
        type: 'mail',
        token,
        user_type: 'user',
        email: user.email,
        purpose: 'forgot-password',
        company_id: user.company_id,
        reference,
        expire_at: time,
      },
    });

    return {
      message: 'Request was processed successfully',
      data: {
        verification_method: tokenType ? 'mail_token' : 'mail_link',
        reference,
      },
    };
  }

  async forgotClientPassword(dto: ForgetPasswordDto): Promise<GenericResponse> {
    const client = await this.prisma.client.findFirst({
      where: { email: dto.email },
      include: {
        company: true,
      },
    });

    if (!client) throw new NotFoundException();

    if (!client.password)
      throw new NotFoundException(
        'Password reset is not available for this account',
      );

    if (client.status === 'disabled' || client?.company?.status !== 'active')
      throw new NotFoundException('Unable to perform request');

    const time = expireIn(60);
    const token = gen6digit().toString();
    const reference = createReference(client.id, 15, 'forgot-password', {
      token,
    });
    const type = client.two_factor_type;
    const link =
      process.env.SWAYAUTH_REDIRECT_URL +
      `?token=${token}&reference=${reference}&intent=forgot-password`;

    await this.mail.sendMail(
      {
        to: client.email,
        first_name: client.first_name,
        company_id: client.company_id,
        time: '1 hour',
        subject: 'Account recovery',
        template: 'forgot-password',
        token: link,
        tokenType: false,
      },
      false,
    );

    await this.prisma.authorizationToken.create({
      data: {
        type,
        token,
        user_type: 'client',
        email: client.email,
        purpose: 'forgot-password',
        company_id: client.company_id,
        reference,
        expire_at: time,
      },
    });

    return {
      message: 'Request was sent successfully',
      data: {
        verification_method: 'mail-link',
        reference,
      },
    };
  }

  async tokenVerify(dto: TotpBaseDto): Promise<GenericResponse> {
    const token = await this.prisma.authorizationToken.findFirst({
      where: {
        reference: dto.reference,
      },
    });
    const ref = verifyReference(dto.reference);
    if (ref.token != dto.token || !token || token.used)
      throw new BadRequestException('Invalid / expired  reference & token');
    return {
      data: {
        purpose: ref.purpose,
        email: ref.email,
        require_password: Boolean(ref?.set_password),
      },
    };
  }

  async forgetPasswordNewPassword(
    dto: ChangePasswordDto,
  ): Promise<GenericResponse> {
    const ref = verifyReference(dto.reference);
    if (ref?.token != dto?.token)
      throw new BadRequestException('Invalid / expired  reference & token');
    const data = await this.verifyAuthorizationTotp(dto, ['forgot-password']);
    const password = await argon.hash(dto.password);
    await (this.prisma[data.user_type] as Prisma.UserDelegate).update({
      where: {
        id: ref.id,
      },
      data: {
        password,
      },
    });

    return { message: 'Request was processed successful' };
  }

  async registerUser(
    dto: RegisterDto,
    organizationToken: OrganizationToken,
    ip_address: string,
  ): Promise<GenericResponse> {
    // const allowReg = await this.subscription.allowUserRegistration(organizationToken.company_id)

    // if (!allowReg) throw new BadRequestException('Subscription service has expired or exceeded user registration limit');

    let user = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        organization_id: organizationToken.organization_id,
      },
    });

    if (user && user.verified)
      throw new ConflictException('User already exists');

    const organization = await this.prisma.organization.findFirst({
      where: {
        id: organizationToken.organization_id,
      },
      include: {
        company: {
          include: {
            service_email: true,
          },
        },
      },
    });

    if (organization?.company?.status !== 'active')
      throw new NotFoundException('Organization does not exist or inactive');

    if (
      organizationToken.verify_registration &&
      !organizationToken.scope.includes('mail') &&
      !organizationToken.scope.includes('sms')
    )
      throw new UnauthorizedException(
        'Organization does not allow email or sms verification',
      );

    const password = await argon.hash(dto.password);

    const userData = {
      ...dto,
      password,
      organization_token_id: organizationToken.id,
      verified: !organizationToken.verify_registration,
      organization_id: organizationToken.organization_id,
      company_id: organization?.company?.id,
      ip_address,
    } as User;

    if (user) {
      user = await this.prisma.user.update({
        where: {
          id: user.id,
          email: dto.email,
          organization_id: organizationToken.organization_id,
        },
        data: userData,
      });
    } else {
      user = await this.prisma.user.create({
        data: userData,
      });
    }

    const time = expireIn(60 * 24);
    const token = gen6digit().toString();
    const reference = createReference(user.id, 60 * 24, 'register', { token });

    await this.prisma.manual.create({
      data: {
        user_id: user.id,
        company_id: user.company_id,
        ip_address,
        purpose: 'register',
      },
    });

    let mailObject: Parameters<typeof this.mail.sendMail>[number] = {
      to: user.email,
      subject: 'Thank you for registering!',
      template: 'register',
      company_id: user.company_id,
      first_name: user.first_name,
      image:
        organization.photo || organization?.company?.service_email?.[0]?.photo,
      time: '24 hours',
      location: organization?.address,
      domain: organization?.website,
      companyName: organization?.name,
    };

    if (organization?.company?.service_email?.[0]?.verified) {
      mailObject = {
        ...mailObject,
        from: organization?.company?.service_email?.[0]?.email,
        username: organization?.company?.service_email?.[0]?.username,
        password: Decrypt(organization?.company?.service_email?.[0]?.password),
        host: organization?.company?.service_email?.[0]?.host,
        image: organization?.company?.service_email?.[0]?.photo,
      };
    }

    if (organizationToken.verify_registration) {
      const type = organizationToken.verify_registration_type;
      const redirect_url = organizationToken.redirect_url;
      const tokenType = redirect_url && type == 'mail_link' ? false : true;
      const link =
        redirect_url + `?token=${token}&reference=${reference}&intent=register`;
      if (type != 'sms' || (type == 'sms' && !dto.phone)) {
        mailObject = {
          ...mailObject,
          token: tokenType ? token : link,
          tokenType,
        };

        await this.mail.sendMail(mailObject);

        await this.prisma.mail.create({
          data: {
            ['user_id']: user.id,
            token: tokenType ? token : link,
            company_id: organization?.company?.id,
            purpose: 'register',
          },
        });
      } else {
        await this.sms.sendSMSToken({
          phone: user.phone,
          time: '24 hours',
          company_name: organization?.name,
          first_name: user.first_name,
          company_id: user.company_id,
          token,
        });
        await this.prisma.sms.create({
          data: {
            ['user_id']: user.id,
            token: tokenType ? token : link,
            company_id: organization?.company?.id,
            purpose: 'register',
          },
        });
      }

      await this.prisma.authorizationToken.create({
        data: {
          type: type == 'sms' ? 'sms' : 'mail',
          token,
          user_type: 'user',
          email: userData.email,
          purpose: 'register',
          company_id: userData.company_id,
          reference,
          expire_at: time,
        },
      });

      return {
        message: 'Registration was successful',
        data: {
          reference,
          verify_registration: organizationToken.verify_registration,
          verify_registration_type: organizationToken.verify_registration
            ? type == 'sms' && dto.phone
              ? 'sms'
              : tokenType
                ? 'mail_token'
                : 'mail_link'
            : null,
        },
      };
    } else {
      mailObject = {
        ...mailObject,
        template: 'register-complete',
      };

      await this.mail.sendMail(mailObject);
    }

    return { message: 'Registration was successful' };
  }

  async registerResend(
    dto: ForgetPasswordDto,
    userType: 'user' | 'client',
    organizationToken?: OrganizationToken,
  ) {
    let user: Partial<User> &
      Partial<Client> & { organization?: Organization } & {
        company?: Company & { service_email?: ServiceMail[] };
      };
    const tokenData = await this.prisma.authorizationToken.findFirst({
      where: {
        email: user?.email,
        purpose: 'register',
        user_type: userType,
        expire_at: {
          gte: Date.now(),
        },
      },
      orderBy: { id: 'desc' },
    });

    if (!tokenData) throw new NotFoundException('User not found');

    if (userType == 'user' && organizationToken?.organization_id) {
      user = await this.prisma.user.findFirst({
        where: {
          email: dto.email,
          // verified: false,
          organization_id: organizationToken.organization_id,
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
      user = await this.prisma.client.findFirst({
        where: { email: dto.email, verified: false },
      });
    }

    if (!user) throw new NotFoundException('User not found');

    const type = organizationToken?.verify_registration_type;
    const redirect_url = organizationToken?.redirect_url;
    const link =
      organizationToken?.redirect_url +
      `?token=${tokenData.token}&reference=${tokenData.reference}&intent=register`;

    let mailObject: Parameters<typeof this.mail.sendMail>[number] = {
      to: user?.email,
      subject: 'Thank you for registering!',
      template: 'register',
      company_id: user?.company_id || 'swayauth',
      first_name: user?.first_name,
      image: user?.company.photo || user?.company?.service_email?.[0]?.photo,
      time: '24 hours',
      location: user?.company?.address,
      domain: user?.organization?.website,
      companyName: user?.organization?.name,
    };
    const id_choice =
      userType == 'user' ? { user_id: user?.id } : { client_id: user?.id };
    if (type != 'sms' || (type == 'sms' && !user?.phone)) {
      mailObject = {
        ...mailObject,
        token: redirect_url ? link : tokenData.token,
        tokenType: redirect_url ? false : true,
      };
      await this.mail.sendMail(mailObject);
      await this.prisma.mail.create({
        data: {
          ...id_choice,
          token: tokenData.token,
          company_id: tokenData.company_id,
          purpose: 'register',
        },
      });
    } else {
      await this.sms.sendSMSToken({
        phone: user?.phone,
        time: '24 hours',
        company_name: user?.organization?.name,
        first_name: user?.first_name,
        company_id: tokenData?.company_id,
        token: tokenData?.token,
      });
      await this.prisma.sms.create({
        data: {
          ...id_choice,
          token: tokenData?.token,
          company_id: tokenData.company_id,
          purpose: 'register',
        },
      });
    }

    return { data: null };
  }

  async registerClient(
    dto: RegisterClientDto,
    ip_address: string,
  ): Promise<GenericResponse> {
    let client = await this.prisma.client.findFirst({
      where: { email: dto.email },
    });

    if (client) throw new ConflictException('Account already exists');

    const password = await argon.hash(dto.password);
    const time = expireIn(60 * 24 * 3);
    const token = gen6digit().toString();
    const app_key = generateAppKey(dto.email);

    const wallet = await this.prisma.wallet.create({ data: {} });
    const appKey = await this.prisma.appKey.create({ data: { key: app_key } });

    const company = await this.prisma.company.create({
      data: {
        email: dto.email,
        name: dto.company_name || dto.first_name,
        wallet_id: wallet.id as never,
        app_key_id: appKey.id as never,
      },
    });

    delete dto?.company_name;

    client = await this.prisma.client.create({
      data: {
        ...dto,
        password,
        company_id: company.id,
        ip_address,
      },
    });

    const association = await this.prisma.association.create({
      data: {
        creator: true,
        permissions: ['read', 'write', 'delete'],
        access: 'level_3',
        company_id: company.id,
        client_email: client.email,
      },
    });

    const reference = createReference(client.id, 60 * 24 * 3, 'register', {
      new: true,
      token,
      association_id: association.id,
    });

    const link =
      process.env.SWAYAUTH_REDIRECT_URL +
      `?token=${token}&reference=${reference}&intent=register&as=client`;

    await this.mail.sendMail(
      {
        to: client.email,
        time: '24 hours',
        company_id: client.company_id,
        subject: 'Thank you for registering!',
        template: 'register',
        token: link,
        tokenType: false,
      },
      false,
    );

    await this.prisma.authorizationToken.create({
      data: {
        type: 'mail',
        token,
        email: client.email,
        user_type: 'client',
        purpose: 'register',
        reference,
        company_id: company.id,
        expire_at: time,
      },
    });

    await this.prisma.manual.create({
      data: {
        client_id: client.id,
        company_id: client.company_id,
        ip_address,
        purpose: 'register',
      },
    });

    return {
      data: {
        verification_enabled: true,
        verification_type: 'mail-link',
        reference,
      },
    };
  }

  async get2AuthAllowed(jwt: JWTProp) {
    let person: Partial<
      User &
        Client & {
          organization_token: OrganizationToken;
          company: Company & { service_email: ServiceMail[] };
        }
    >;
    if (jwt.access === 'level_1') {
      person = await this.prisma.user.findFirst({
        where: {
          id: jwt.sub,
        },
        include: {
          organization: true,
          organization_token: true,
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
    } else if (['level_2', 'level_3'].includes(jwt.access)) {
      person = await this.prisma.client.findFirst({
        where: {
          id: jwt.sub,
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
    } else {
      person = await this.prisma.admin.findFirst({
        where: {
          id: jwt.sub,
        },
      });
    }

    let twoFactor = [];
    if (jwt.access == 'level_1') {
      if (!person.organization_token?.scope?.includes('two_factor'))
        return twoFactor;
      return twoFactor.concat(person.organization_token?.two_factor_type);
    } else {
      twoFactor = twoFactor.concat(['app', 'mail']);
      if (person.phone) twoFactor.push('sms');
      return twoFactor;
    }
  }

  async twoFactorEnable(dto: TotpEnableDto, jwt: JWTProp) {
    const isAdmin = ['level_4', 'level_5'].includes(jwt.access);
    // const allow2Fa = isAdmin ? true : await this.subscription.allow2fa(jwt.company_id)
    // if (!allow2Fa) throw new BadRequestException('Subscription service has expired or 2fa is not allowed for this account');

    let person: Partial<
      User &
        Client & {
          organization: Organization;
          organization_token: OrganizationToken;
          company: Company & { service_email: ServiceMail[] };
        }
    >;
    if (jwt.access === 'level_1') {
      person = await this.prisma.user.findFirst({
        where: {
          id: jwt.sub,
        },
        include: {
          organization: true,
          organization_token: true,
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
    } else if (!isAdmin) {
      person = await this.prisma.client.findFirst({
        where: {
          id: jwt.sub,
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
    } else {
      person = await this.prisma.admin.findFirst({
        where: {
          id: jwt.sub,
        },
      });
    }

    if (jwt.access === 'level_1') {
      if (
        !person.organization_token?.scope?.includes('two_factor') ||
        !person.organization_token?.two_factor_type?.includes(dto.type)
      )
        throw new UnauthorizedException(
          `Authentication by ${dto.type} is not allowed for this account`,
        );
    }

    if (
      person?.scope?.includes('two_factor') &&
      person.two_factor_type == dto.type
    )
      throw new ConflictException(
        `Account already has ${dto.type} two-factor authentication enabled`,
      );

    const token = gen6digit().toString();
    const reference = createReference(person.id, 15, 'enable-2factor', {
      token,
    });
    const time = expireIn(15);

    const authData = {
      type: dto.type,
      token,
      user_type:
        jwt.access == 'level_1' ? 'user' : isAdmin ? 'admin' : 'client',
      email: person.email,
      reference,
      company_id: person?.company_id,
      purpose: 'enable-2factor',
      expire_at: time,
    } as AuthorizationToken;

    if (dto.type === 'app') {
      const { status, data, message } = await generateTotp(
        person?.organization_token?.name ||
          person?.organization?.name ||
          person?.company?.name ||
          'Swayauth',
        person.email,
      );
      if (status) {
        await (
          this.prisma[
            jwt.access === 'level_1' ? 'user' : isAdmin ? 'admin' : 'client'
          ] as Prisma.ClientDelegate
        ).update({
          where: { id: person.id },
          data: { totp_secret: data.secret, two_factor_type: 'app' },
        });
        await this.prisma.authorizationToken.create({
          data: authData,
        });
        return {
          qrcode: data.img,
          two_factor_type: dto.type,
          two_factor_enabled: false,
          reference,
        };
      }
      throw new ServiceUnavailableException(message);
    } else if (dto.type === 'sms') {
      if (!person.phone)
        throw new UnauthorizedException(
          'Phone number is required for SMS authentication',
        );

      await this.sms.sendSMSToken(
        {
          phone: person.phone,
          company_name:
            person?.organization_token?.name ||
            person?.organization?.name ||
            person?.company.name ||
            'Swayauth',
          first_name: person.first_name,
          company_id: person.company_id,
          token,
        },
        !isAdmin,
      );
      if (!isAdmin) {
        await this.prisma.sms.create({
          data: {
            [jwt.access === 'level_1' ? 'user_id' : 'client_id']: person.id,
            company_id: person.company?.id,
            purpose: 'two_factor',
          },
        });
      }
    } else {
      let mailOption = {};

      if (
        jwt.access === 'level_1' &&
        person?.company?.service_email?.[0]?.verified
      ) {
        mailOption = {
          from: person?.company?.service_email?.[0]?.email,
          username: person?.company?.service_email?.[0]?.username,
          password: Decrypt(person?.company?.service_email?.[0]?.password),
          host: person?.company?.service_email?.[0]?.host,
          image:
            person?.organization?.photo ||
            person?.company?.service_email?.[0]?.photo,
          location: person?.organization?.address,
          companyName: person?.organization?.name,
        };
      }

      await this.mail.sendMail(
        {
          to: person?.email,
          subject: '2FA Authorization',
          template: 'login',
          token,
          company_id: person.company.id,
          tokenType: true,
          ...mailOption,
        },
        !isAdmin,
      );

      if (!isAdmin) {
        await this.prisma.mail.create({
          data: {
            [jwt.access === 'level_1' ? 'user_id' : 'client_id']: person.id,
            company_id: person.company?.id,
            purpose: 'two_factor',
          },
        });
      }
    }

    await this.prisma.authorizationToken.create({
      data: authData,
    });

    return {
      data: { two_factor_enabled: false, two_factor_type: dto.type, reference },
      message: `Two-Factor Authentication by ${dto.type} is required to complete verification`,
    };
  }

  async twoFactorVerify(
    dto: TotpBaseDto,
  ): Promise<LoginResponse | GenericResponse> {
    const data = await this.verifyAuthorizationTotp(dto, [
      'login',
      'enable-2factor',
    ]);

    const twoFactorData = verifyReference(dto.reference);

    if (data.type === 'app') {
      const verify = verifyTotp(data.person.totp_secret, dto.token);
      if (!verify) {
        throw new UnauthorizedException('Invalid token');
      }
    }

    if (twoFactorData.purpose === 'enable-2factor') {
      const scope = Array.from(
        new Set(data.person.scope.concat(['two_factor'])),
      );

      await (this.prisma[data.user_type] as Prisma.UserDelegate).update({
        where: { id: twoFactorData.id },
        data: {
          scope,
          two_factor_type: data.type,
        },
      });

      return {
        message: '2-factor authentication enabled',
        data: { two_factor_type: data.type },
      };
    } else {
      if (!data.person.scope.includes('two_factor'))
        throw new UnauthorizedException();

      let access = (data.person as User).access;
      let permissions = (data.person as User).permissions;

      if (data.user_type === 'client') {
        const association = await this.prisma.association.findFirst({
          where: {
            company_id: data.company_id,
            client_email: data.person.email,
          },
        });
        access = association.access;
        permissions = association.permissions;
      }

      const tokenGen: GenerateToken = {
        id: data.person.id,
        access,
        company_id: data.company_id,
        email: data.email,
        permissions,
        scope: data.person.scope,
        status: data.person.status,
        two_factor_type: data.person.two_factor_type,
      };

      const access_token = await this.token(tokenGen, '48h');
      const refresh_token = await this.token(tokenGen, '90d');
      return {
        access_token,
        refresh_token,
        two_factor_enabled: true,
        two_factor_type: data.person.two_factor_type,
      };
    }
  }

  async registerVerify(dto: TotpDto): Promise<GenericResponse> {
    const ref = verifyReference(dto.reference);

    if (ref.token !== dto.token)
      throw new BadRequestException('Invalid / expired  reference & token');

    const data = await this.verifyAuthorizationTotp(dto, ['register', 'team']);
    if (data.ref?.set_password && !dto.password) {
      await this.prisma.authorizationToken.update({
        where: { id: ref.id },
        data: { used: false },
      });
      throw new BadRequestException(
        'Please provide a password field to complete the registration process',
      );
    } else if (!data.ref?.set_password && dto.password) {
      await this.prisma.authorizationToken.update({
        where: { id: ref.id },
        data: { used: false },
      });
      throw new BadRequestException(
        "Invalid field 'password'. Please omit password to complete the registration process",
      );
    }

    const update: { verified: boolean; password?: string } = { verified: true };

    if (data.ref?.set_password) {
      update.password = await argon.hash(dto.password);
    }

    await (this.prisma[data.user_type] as Prisma.UserDelegate).update({
      where: {
        id: ref.id,
      },
      data: update,
    });

    if (data.user_type === 'client') {
      if (data.ref.new) {
        await this.prisma.subscription.create({
          data: {
            subscription: 'free',
            company_id: data.person.company_id,
          },
        });
      }
      await this.prisma.association.updateMany({
        where: {
          client_email: data.person.email,
          verified: false,
        },
        data: {
          verified: true,
        },
      });

      await this.prisma.company.update({
        where: {
          email: data.person.email,
        },
        data: {
          verified: true,
        },
      });
    }

    return { message: 'Registeration was successful' };
  }

  async verifyAuthorizationTotp(
    dto: TotpDto,
    purpose: (
      | 'login'
      | 'enable-2factor'
      | 'team'
      | 'forgot-password'
      | 'register'
    )[],
    used = true,
  ) {
    let data: AuthorizationToken;
    try {
      data = await this.prisma.authorizationToken.update({
        where: {
          reference: dto.reference,
          used: false,
          purpose: {
            in: purpose,
          },
        },
        data: {
          used,
        },
      });
    } catch (error: any) {
      throw new NotFoundException('Verification failed');
    }

    let person: Client | null = null;

    if (used) {
      person = await (
        this.prisma[data.user_type] as Prisma.ClientDelegate
      ).findFirst({
        where: {
          email: data.email,
        },
      });

      if (!person) throw new NotFoundException('Verification failed');
    }

    return {
      ...data,
      person,
      ref: verifyReference<{
        new?: boolean;
        association_id: string;
        set_password?: boolean;
      }>(dto.reference),
    };
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
