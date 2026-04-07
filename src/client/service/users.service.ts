import { Injectable } from '@nestjs/common';
import { Company, Prisma, User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ChangeUsersStatus,
  CompanyUserStatisticsDto,
  UserListDto,
} from '../dto';
import { CONST } from 'src/common';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getUsers(params: UserListDto, company: Company) {
    const where = {
      AND: [
        {
          company_id: company.id,
        },
        {
          organization_id: params.organization_id,
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
            {
              organization: {
                name: {
                  contains: params.search,
                  mode: 'insensitive',
                },
              },
            },
          ],
        },
      ],
    } as Prisma.UserWhereInput;

    const combine: { data: User[]; total: number; page: number; size: number } =
      {
        data: [],
        total: 0,
        page: params.page,
        size: params.size,
      };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: {
          organization: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          [params.order_by]: params.direction,
        },
        skip: (params.page - 1) * params.size,
        take: params.size,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { ...combine, data, total };
  }

  async getStatistics(params: CompanyUserStatisticsDto, company: Company) {
    const data: CompanyUserStatisticsDto = Object.keys(params).reduce(
      (acc, curr) => {
        acc[curr] = 0;
        return acc;
      },
      {},
    );

    if (params.users != undefined) {
      data.users = await this.prisma.user.count({
        where: {
          company_id: company.id,
        },
      });
    }

    if (params.active != undefined) {
      data.active = await this.prisma.user.count({
        where: {
          company_id: company.id,
          status: 'active',
        },
      });
    }

    if (params.disabled != undefined) {
      data.disabled = await this.prisma.user.count({
        where: {
          company_id: company.id,
          status: 'disabled',
        },
      });
    }

    if (params.organizations != undefined) {
      data.organizations = await this.prisma.organization.count({
        where: {
          company_id: company.id,
        },
      });
    }

    return data;
  }

  async activateUsers(body: ChangeUsersStatus, company: Company) {
    await this.prisma.user.updateMany({
      where: {
        company_id: company.id,
        id: {
          in: body.user_ids,
        },
      },
      data: {
        verified: true,
        status: 'active',
      },
    });

    return { message: CONST.RESPONSE.PROCESSED_SUCCESSULLY };
  }

  async deactivateUsers(body: ChangeUsersStatus, company: Company) {
    await this.prisma.user.updateMany({
      where: {
        company_id: company.id,
        id: {
          in: body.user_ids,
        },
      },
      data: {
        status: 'disabled',
      },
    });
    return { message: 'Deactivated users successfully' };
  }

  async deleteUser(id: string, company: Company) {
    await this.prisma.user.delete({
      where: {
        id,
        company_id: company.id,
      },
    });
    return { message: CONST.RESPONSE.PROCESSED_SUCCESSULLY };
  }
}
