import { Injectable } from '@nestjs/common';
import { Company } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { DurationEnum, dateRange, rangeGenerator } from '../../common';
import { DurationDto, StatisticsDto } from '../dto';

@Injectable()
export class StatisticsService {
  constructor(private prisma: PrismaService) {}

  async getStatCount(params: StatisticsDto, company: Company) {
    const data: StatisticsDto = Object.keys(params).reduce((acc, curr) => {
      acc[curr] = curr == 'duration' ? params.duration : 0;
      return acc;
    }, {});

    if (params.users != undefined) {
      data.users = await this.prisma.user.count({
        where: {
          company_id: company.id,
          created_at: dateRange(params.duration),
        },
      });
    }

    if (params.sms != undefined) {
      data.sms = await this.prisma.sms.count({
        where: {
          company_id: company.id,
          created_at: dateRange(params.duration),
        },
      });
    }

    if (params.manual != undefined) {
      data.manual = await this.prisma.manual.count({
        where: {
          company_id: company.id,
          created_at: dateRange(params.duration),
        },
      });
    }

    if (params.mail != undefined) {
      data.mail = await this.prisma.mail.count({
        where: {
          company_id: company.id,
          created_at: dateRange(params.duration),
        },
      });
    }

    if (params.facebook != undefined) {
      data.facebook = await this.prisma.facebook.count({
        where: {
          company_id: company.id,
          created_at: dateRange(params.duration),
        },
      });
    }

    if (params.google != undefined) {
      data.google = await this.prisma.google.count({
        where: {
          company_id: company.id,
          created_at: dateRange(params.duration),
        },
      });
    }

    return data;
  }

  async getRegUserCount(params: DurationDto, company: Company) {
    let promises: Array<Promise<number>>;
    if (params.duration === DurationEnum['7_days']) {
      promises = Array(7)
        .fill(0)
        .map((_, i) =>
          this.prisma.user.count({
            where: {
              company_id: company.id,
              created_at: rangeGenerator(i, i + 1),
            },
          }),
        );
    } else if (params.duration === DurationEnum['14_days']) {
      promises = Array(14)
        .fill(0)
        .map((_, i) =>
          this.prisma.user.count({
            where: {
              company_id: company.id,
              created_at: rangeGenerator(i, i + 1),
            },
          }),
        );
    } else if (params.duration === DurationEnum['30_days']) {
      promises = Array(4)
        .fill(0)
        .map((_, i) =>
          this.prisma.user.count({
            where: {
              company_id: company.id,
              created_at: rangeGenerator(i * 7, (i + 1) * 7),
            },
          }),
        );
    } else if (params.duration === DurationEnum['6_months']) {
      promises = Array(6)
        .fill(0)
        .map((_, i) =>
          this.prisma.user.count({
            where: {
              company_id: company.id,
              created_at: rangeGenerator(i * 30, (i + 1) * 30),
            },
          }),
        );
    } else {
      promises = Array(12)
        .fill(0)
        .map((_, i) =>
          this.prisma.user.count({
            where: {
              company_id: company.id,
              created_at: rangeGenerator(i * 30, (i + 1) * 30),
            },
          }),
        );
    }

    const graph = await Promise.all(promises.reverse());

    return { graph, duration: params.duration };
  }

  async getLoginUserCount(params: DurationDto, company: Company) {
    const data = {
      facebook: 0,
      google: 0,
      manual: 0,
      duration: params.duration,
    };
    data.facebook = await this.prisma.facebook.count({
      where: {
        company_id: company.id,
        purpose: 'login',
        created_at: dateRange(params.duration),
      },
    });

    data.manual = await this.prisma.manual.count({
      where: {
        company_id: company.id,
        purpose: 'login',
        created_at: dateRange(params.duration),
      },
    });

    data.google = await this.prisma.google.count({
      where: {
        company_id: company.id,
        purpose: 'login',
        created_at: dateRange(params.duration),
      },
    });

    return data;
  }
}
