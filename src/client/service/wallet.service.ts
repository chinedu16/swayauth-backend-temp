import { Injectable, NotFoundException } from '@nestjs/common';
import { Company } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { FundWalletDto } from '../dto/wallet.dto';
import { PaymentService } from 'src/payment/payment.service';

@Injectable()
export class WalletService {
  constructor(
    private prisma: PrismaService,
    private paymentService: PaymentService,
  ) {}

  async getBalance(company: Company) {
    return (
      await this.prisma.company.findFirst({
        where: {
          id: company.id,
        },
        select: {
          wallet: {
            select: {
              id: true,
              amount: true,
            },
          },
        },
      })
    ).wallet;
  }

  async fundWallet(dto: FundWalletDto, company: Company) {
    return await this.paymentService.generateAccessCode({
      email: company.email,
      amount: dto.amount,
      metadata: {
        transaction_type: 'wallet',
        company_id: company.id,
        purpose: 'wallet topup',
        save_card: String(company.save_cards) as 'true' | 'false',
      },
    });
  }

  async cardPayment(id: string, dto: FundWalletDto, company: Company) {
    const card = await this.prisma.card.findFirst({
      where: {
        id,
        company_email: company.email,
      },
    });

    if (!card) throw new NotFoundException('No card found');

    return await this.paymentService.chargeSavedCard({
      amount: dto.amount,
      authorization_code: card.authorization_code,
      email: company.email,
      metadata: {
        transaction_type: 'wallet',
        company_id: company.id,
        purpose: 'Wallet Topup',
        save_card: String(company.save_cards) as 'true' | 'false',
      },
    });
  }
}
