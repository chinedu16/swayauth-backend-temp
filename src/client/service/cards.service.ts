import { Injectable } from '@nestjs/common';
import { Company } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SaveCardsDto } from '../dto/wallet.dto';

@Injectable()
export class CardsService {
  constructor(private prisma: PrismaService) {}

  async getCards(company: Company) {
    return await this.prisma.card.findMany({
      where: {
        company_email: company.email,
      },
      take: 2,
      orderBy: {
        id: 'desc',
      },
    });
  }

  async saveCards(dto: SaveCardsDto, company: Company) {
    await this.prisma.company.update({
      where: {
        id: company.id,
      },
      data: {
        save_cards: dto.status,
      },
    });
    return { message: 'Request was processed successfully' };
  }

  async deleteCard(id: string, company: Company) {
    const delResponse = await this.prisma.card.delete({
      where: {
        id,
        company_email: company.email,
      },
    });

    return {
      status: !!delResponse,
      message: 'Request was processed successfully',
    };
  }
}
