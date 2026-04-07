import { Injectable } from '@nestjs/common';
import { DurationDto } from 'src/client/dto';
import { DurationEnum, dateRange, rangeGenerator } from '../../common';
import { PaymentService } from '../../payment/payment.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminStatisticsDto } from '../dto';

@Injectable()
export class StatisticsService {
  constructor(
    private prisma: PrismaService,
    private payment: PaymentService,
  ) {}

  async getStatCount(params: AdminStatisticsDto) {
    const data: AdminStatisticsDto = Object.keys(params).reduce((acc, curr) => {
      acc[curr] = curr == 'duration' ? params.duration : 0;
      return acc;
    }, {});

    if (params.users != undefined) {
      data.users = await this.prisma.user.count({
        where: {
          created_at: dateRange(params.duration),
        },
      });
    }

    if (params.clients != undefined) {
      data.clients = await this.prisma.client.count({
        where: {
          created_at: dateRange(params.duration),
        },
      });
    }

    if (params.allClients != undefined) {
      data.allClients = await this.prisma.client.count();
    }

    if (params.revenue != undefined) {
      const balance = await this.payment.getBalance();
      if (balance.status) {
        data.revenue = balance.data.balance;
      }
    }

    return data;
  }

  async getClientCount(params: DurationDto) {
    let promises: Array<Promise<number>>;
    if (params.duration === DurationEnum['7_days']) {
      promises = Array(7)
        .fill(0)
        .map((_, i) =>
          this.prisma.client.count({
            where: {
              created_at: rangeGenerator(i, i + 1),
            },
          }),
        );
    } else if (params.duration === DurationEnum['14_days']) {
      promises = Array(14)
        .fill(0)
        .map((_, i) =>
          this.prisma.client.count({
            where: {
              created_at: rangeGenerator(i, i + 1),
            },
          }),
        );
    } else if (params.duration === DurationEnum['30_days']) {
      promises = Array(4)
        .fill(0)
        .map((_, i) =>
          this.prisma.client.count({
            where: {
              created_at: rangeGenerator(i * 7, (i + 1) * 7),
            },
          }),
        );
    } else if (params.duration === DurationEnum['6_months']) {
      promises = Array(6)
        .fill(0)
        .map((_, i) =>
          this.prisma.client.count({
            where: {
              created_at: rangeGenerator(i * 30, (i + 1) * 30),
            },
          }),
        );
    } else {
      promises = Array(12)
        .fill(0)
        .map((_, i) =>
          this.prisma.client.count({
            where: {
              created_at: rangeGenerator(i * 30, (i + 1) * 30),
            },
          }),
        );
    }

    const graph = await Promise.all(promises.reverse());

    return { graph, duration: params.duration };
  }

  async getIntegrationCount(params: DurationDto) {
    const data = {
      facebook: 0,
      sms: 0,
      mail: 0,
      two_factor: 0,
      google: 0,
      manual: 0,
      duration: params.duration,
    };

    data.facebook = await this.prisma.facebook.count({
      where: {
        created_at: dateRange(params.duration),
      },
    });

    data.manual = await this.prisma.manual.count({
      where: {
        created_at: dateRange(params.duration),
      },
    });

    data.google = await this.prisma.google.count({
      where: {
        created_at: dateRange(params.duration),
      },
    });

    data.two_factor = await this.prisma.twoFactor.count({
      where: {
        created_at: dateRange(params.duration),
      },
    });

    data.sms = await this.prisma.sms.count({
      where: {
        created_at: dateRange(params.duration),
      },
    });

    data.mail = await this.prisma.mail.count({
      where: {
        created_at: dateRange(params.duration),
      },
    });

    return data;
  }

  async getRecentClients() {
    return await this.prisma.company.findMany({
      take: 10,
      orderBy: {
        id: 'desc',
      },
      include: {
        wallet: true,
        subscription: {
          where: {
            subscription: {
              not: 'free',
            },
          },
          take: 1,
          orderBy: {
            id: 'desc',
          },
        },
        _count: {
          select: {
            user: true,
            organization: true,
          },
        },
      },
    });
  }
}
