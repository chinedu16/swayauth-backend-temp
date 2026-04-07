import { Injectable } from '@nestjs/common';
import { CONST } from 'src/common';
import { ChangeUsersStatus } from '../../client/dto';
import { PrismaService } from '../../prisma/prisma.service';
import { ClientDto } from '../dto/client.dto';
import { Company, Prisma } from '@prisma/client';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async getClients(params: ClientDto) {
    const where = {
      AND: [
        {
          OR: [
            {
              name: {
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
    } as Prisma.CompanyWhereInput;

    const combine: {
      data: Company[];
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
      this.prisma.company.findMany({
        where,
        include: {
          wallet: {
            select: {
              amount: true,
            },
          },
          subscription: {
            where: {
              subscription: {
                not: 'free',
              },
            },
            select: {
              subscription: true,
              created_at: true,
            },
            take: 1,
            orderBy: {
              id: 'desc',
            },
          },
          _count: {
            select: {
              organization: true,
              user: true,
            },
          },
        },
        orderBy: {
          [params.order_by]:
            params.order_by == 'wallet'
              ? {
                  amount: params.direction,
                }
              : params.direction,
        },
        skip: (params.page - 1) * params.size,
        take: params.size,
      }),
      this.prisma.company.count({ where }),
    ]);

    return { ...combine, data, total };
  }

  async getOneClient(id: string) {
    return await this.prisma.company.findFirst({
      where: {
        id,
      },
      include: {
        service_email: {
          select: {
            website: true,
          },
        },
        wallet: {
          select: {
            amount: true,
          },
        },
        organization: {
          select: {
            name: true,
            id: true,
            photo: true,
            website: true,
            address: true,
            created_at: true,
            _count: {
              select: {
                user: true,
                organization_token: true,
              },
            },
          },
        },
        _count: {
          select: {
            organization: true,
            user: true,
          },
        },
      },
    });
  }

  async activateClients(body: ChangeUsersStatus) {
    await this.prisma.company.updateMany({
      where: {
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

  async deactivateClients(body: ChangeUsersStatus) {
    await this.prisma.company.updateMany({
      where: {
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

  async deleteClient(id: string) {
    await this.prisma.client.delete({
      where: {
        id,
      },
    });
    return { message: CONST.RESPONSE.PROCESSED_SUCCESSULLY };
  }
}
