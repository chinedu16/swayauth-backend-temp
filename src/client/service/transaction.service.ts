import { Injectable } from '@nestjs/common';
import { Company, Transaction } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { TransactionListDto } from '../dto/transactions.dto';

@Injectable()
export class TransactionService {
  constructor(private prisma: PrismaService) {}

  async getTransactions(params: TransactionListDto, company: Company) {
    const sort = {
      skip: (params.page - 1) * params.size,
      take: params.size,
    };

    if (params.page == -1) {
      delete sort.take;
      sort.skip = 0;
    }

    const combine: {
      data: Transaction[];
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
      this.prisma.transaction.findMany({
        where: {
          AND: [
            {
              company_id: company.id,
            },
          ],
        },
        orderBy: {
          id: 'desc',
        },
        ...sort,
      }),
      this.prisma.transaction.count({
        where: {
          AND: [
            {
              company_id: company.id,
            },
          ],
        },
      }),
    ]);

    return { ...combine, data, total };
  }
}
