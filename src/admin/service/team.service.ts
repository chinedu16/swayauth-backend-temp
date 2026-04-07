import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CONST, createReference, expireIn, gen6digit } from 'src/common';
import { JWTProp } from '../../auth/type';
import {
  ChangeUsersStatus,
  PermissionsDtoAdmin,
  TeamListDto,
} from '../../client/dto';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAdminTeamDto } from '../dto/team.dto';
import { Admin, Prisma } from '@prisma/client';

@Injectable()
export class TeamService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  async getTeam(params: TeamListDto, user: JWTProp) {
    const where = {
      AND: [
        {
          id: {
            not: user.sub,
          },
        },
        {
          OR: [
            {
              first_name: {
                contains: params.search,
                mode: 'insensitive',
              },
            },
            {
              last_name: {
                contains: params.search,
                mode: 'insensitive',
              },
            },
            {
              email: {
                contains: params.search,
                mode: 'insensitive',
              },
            },
            {
              phone: {
                contains: params.search,
                mode: 'insensitive',
              },
            },
            {
              address: {
                contains: params.search,
                mode: 'insensitive',
              },
            },
            {
              city: {
                contains: params.search,
                mode: 'insensitive',
              },
            },
            {
              state: {
                contains: params.search,
                mode: 'insensitive',
              },
            },
          ],
        },
      ],
    } as Prisma.AdminWhereInput;

    const combine: {
      data: Admin[];
      total: number;
      page: number;
      size: number;
    } = {
      data: [],
      total: 0,
      page: params.page,
      size: params.size,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.admin.findMany({
        where,
        orderBy: {
          [params.order_by]: params.direction,
        },
        skip: (params.page - 1) * params.size,
        take: params.size,
      }),
      this.prisma.admin.count({ where }),
    ]);

    return { ...combine, data, total };
  }

  async teamCount(user: JWTProp) {
    return await this.prisma.admin.count({
      where: {
        id: {
          not: user.sub,
        },
      },
    });
  }

  async activateTeam(body: ChangeUsersStatus, user: JWTProp) {
    await this.prisma.admin.updateMany({
      where: {
        id: {
          in: body.user_ids.filter((id) => id != user.sub),
        },
      },
      data: {
        verified: true,
        status: 'active',
      },
    });

    return { message: CONST.RESPONSE.PROCESSED_SUCCESSULLY };
  }

  async deactivateTeam(body: ChangeUsersStatus, user: JWTProp) {
    await this.prisma.admin.updateMany({
      where: {
        id: {
          in: body.user_ids.filter((id) => id != user.sub),
        },
      },
      data: {
        status: 'disabled',
      },
    });
    return { message: 'Deactivated users successfully' };
  }

  async addTeam(dto: CreateAdminTeamDto) {
    let admin = await this.prisma.admin.findFirst({
      where: {
        email: dto.email,
      },
    });

    if (admin) throw new ConflictException('Account already exsist');

    admin = await this.prisma.admin.create({
      data: dto,
    });

    const token = gen6digit().toString();
    const metadata = { set_password: true, token, email: dto.email, new: true };
    const reference = createReference(admin.id, 60 * 24 * 3, 'team', metadata);
    const time = expireIn(60 * 24 * 3);
    const link =
      process.env.SWAYAUTH_ADMIN_REDIRECT_URL +
      `?token=${token}&reference=${reference}&intent=team&email=${admin.email}&account=new`;

    await this.prisma.authorizationToken.create({
      data: {
        type: 'mail',
        token,
        purpose: 'team',
        reference,
        user_type: 'admin',
        email: admin.email,
        expire_at: time,
      },
    });

    await this.mail.sendMail(
      {
        to: dto.email,
        subject: 'You have been invited to join the team on Swayauth',
        template: 'team-invite',
        token: link,
        company_id: 'Swayauth',
        first_name: dto.first_name,
        companyName: process.env.SWAYAUTH_COMPANY_NAME,
        tokenType: false,
      },
      false,
    );

    return {
      data: admin,
      message: 'An invite have been sent to your team member',
    };
  }

  async deleteTeamMember(id: string, user: JWTProp) {
    if (id == user.sub) throw new NotFoundException('Record not found');
    const record = await this.prisma.admin.delete({
      where: {
        id,
      },
    });

    if (!record) throw new NotFoundException('Record not found');
    return { message: 'Member removed successfully' };
  }

  async changePermission(dto: PermissionsDtoAdmin, id: string) {
    const change = await this.prisma.admin.update({
      where: {
        id,
      },
      data: dto,
    });
    if (!change) throw new NotFoundException('Record not found');
    return { data: change, message: 'Member permission changed successfully' };
  }
}
