import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Association, Client, Company } from '@prisma/client';
import {
  createReference,
  expireIn,
  gen6digit,
  generateAppKey,
} from '../../common';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JWTProp } from '../../auth/type';
import { CreateTeamDto, PermissionsDto, TeamListDto } from '../dto';
import { SubscriptionService } from '../../subscription/subscription.service';

@Injectable()
export class TeamService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private subscription: SubscriptionService,
  ) {}

  async getTeam(params: TeamListDto, jwt: JWTProp | null, company: Company) {
    const where: {
      association: {
        some: {
          company_id: string;
        };
      };
      id?: { not: string };
    } = {
      association: {
        some: {
          company_id: company.id,
        },
      },
    };

    if (jwt) where.id = { not: jwt.sub };

    const sort = {
      skip: (params.page - 1) * params.size,
      take: params.size,
    };

    if (params.page == -1) {
      delete sort.take;
      sort.skip = 0;
    }

    const combine: { data: any[]; total: number; page: number; size: number } =
      {
        data: [],
        total: 0,
        page: params.page,
        size: params.size,
      };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        include: {
          association: {
            where: {
              company_id: company.id,
            },
          },
        },
        orderBy: {
          [params.order_by]: params.direction,
        },
        ...sort,
      }),
      this.prisma.client.count({ where }),
    ]);

    for (let i = 0; i < data.length; i++) {
      data[i].association = data[i].association[0] as never;
    }

    return { ...combine, data, total };
  }

  async addTeam(dto: CreateTeamDto, company: Company) {
    // const allowTeamCreate = await this.subscription.allowTeamCreate(company.id)

    // if (!allowTeamCreate) throw new BadRequestException('Subscription service has expired or exceeded invite limit');

    let client = await this.prisma.client.findFirst({
      where: {
        email: dto.email,
      },
      include: {
        association: {
          where: {
            client_email: dto.email,
            company_id: company.id,
          },
        },
      },
    });

    if (client && client?.association?.length) {
      if (client.association[0].creator === true) {
        throw new ConflictException('You cannot invite yourself');
      } else {
        throw new ConflictException('An invite to this account have been sent');
      }
    }

    const newUser = !client;

    const { access, permissions, ...rest } = dto;

    if (newUser) {
      const app_key = generateAppKey(dto.email);
      const wallet = await this.prisma.wallet.create({ data: {} });
      const appKey = await this.prisma.appKey.create({
        data: { key: app_key },
      });
      const newCompany = await this.prisma.company.create({
        data: {
          email: dto.email,
          name: dto.first_name,
          wallet_id: wallet.id as never,
          app_key_id: appKey.id as never,
        },
      });
      client = (await this.prisma.client.create({
        data: {
          ...rest,
          company_id: company.id,
        },
      })) as Client & { association: Association[] };

      await this.prisma.association.create({
        data: {
          creator: true,
          permissions: ['read', 'write', 'delete'],
          access: 'level_3',
          company_id: newCompany.id,
          client_email: client.email,
        },
      });
    }

    const association = await this.prisma.association.create({
      data: {
        access,
        permissions,
        company_id: company.id,
        client_email: dto.email,
      },
    });

    const token = gen6digit().toString();

    const metadata = {
      new: newUser,
      set_password: newUser,
      token,
      email: dto.email,
      association_id: association.id,
    };

    const reference = createReference(client.id, 60 * 24 * 3, 'team', metadata);

    const time = expireIn(60 * 24 * 3);
    const link =
      process.env.SWAYAUTH_REDIRECT_URL +
      `?token=${token}&reference=${reference}&intent=team&email=${client.email}&account=${newUser ? 'new' : 'old'}`;

    await this.prisma.authorizationToken.create({
      data: {
        type: 'mail',
        token,
        purpose: 'team',
        reference,
        user_type: 'client',
        company_id: company.id,
        email: client.email,
        expire_at: time,
      },
    });

    await this.mail.sendMail({
      to: dto.email,
      subject: 'You have been invited to join the team on Swayauth',
      template: 'team-invite',
      token: link,
      company_id: company.id,
      first_name: dto.first_name,
      companyName: company.name,
      tokenType: false,
    });

    await this.prisma.mail.create({
      data: {
        client_id: client.id,
        company_id: company?.id,
        purpose: 'register',
      },
    });

    await this.prisma.manual.create({
      data: {
        client_id: client.id,
        company_id: company.id,
        purpose: 'register',
      },
    });
    return { message: 'An invite have been sent to your team member' };
  }

  async deleteTeamMember(id: string, company: Company) {
    const record = await this.prisma.association.deleteMany({
      where: {
        client: {
          id: id,
        },
        creator: false,
        company_id: company.id,
      },
    });

    if (!record.count) throw new NotFoundException('Record not found');
    return { message: 'Member removed successfully' };
  }

  async changePermission(dto: PermissionsDto, id: string, company: Company) {
    const change = await this.prisma.association.updateMany({
      where: {
        client: {
          id: id,
        },
        creator: false,
        company_id: company.id,
      },
      data: dto,
    });
    if (!change.count) throw new NotFoundException('Record not found');
    return { message: 'Member permission changed successfully' };
  }
}
