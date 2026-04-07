import { Injectable } from '@nestjs/common';
import { UserListDto } from '../../client/dto';
import { OrganizationListBaseDto } from '../../client/dto/organizations.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationToken, Prisma, User } from '@prisma/client';

@Injectable()
export class OrganizationService {
  constructor(private prisma: PrismaService) {}

  async getOneOrganization(id: string, users?: string) {
    const include =
      typeof users != 'undefined'
        ? {
            include: {
              _count: {
                select: {
                  user: true,
                },
              },
            },
          }
        : null;

    return await this.prisma.organization.findFirst({
      where: { id },
      ...include,
    });
  }

  async getOneOrganizationTokens(id: string, params: OrganizationListBaseDto) {
    const combine: {
      data: OrganizationToken[];
      total: number;
      page: number;
      size: number;
    } = {
      data: [],
      total: 0,
      page: params.page,
      size: params.size,
    };
    const sort = {
      skip: (params.page - 1) * params.size,
      take: params.size,
    };

    if (params.page == -1) {
      delete sort.take;
      sort.skip = 0;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.organizationToken.findMany({
        where: {
          organization_id: id,
        },
        ...sort,
      }),
      this.prisma.organizationToken.count({ where: { organization_id: id } }),
    ]);

    return { ...combine, data, total };
  }

  async getOneOrganizationUserList(id: string, params: UserListDto) {
    const where = {
      AND: [
        {
          organization_id: id,
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
}
