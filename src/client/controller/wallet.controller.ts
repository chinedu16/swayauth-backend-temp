import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Company } from '@prisma/client';
import { AccessGuard, CompanyGuard, PermissionGuard } from '../../auth/guard';
import { GetCompany } from '../decorator';
import { WalletService } from '../service/wallet.service';
import { FundWalletDto } from '../dto/wallet.dto';

@Controller({ version: '1', path: 'client/wallet' })
@UseGuards(CompanyGuard)
export class CompanyWalletController {
  constructor(private walletService: WalletService) {}

  @Get('balance')
  @HttpCode(HttpStatus.OK)
  getBalance(@GetCompany() company: Company) {
    return this.walletService.getBalance(company);
  }

  @Post('init-payment')
  @HttpCode(HttpStatus.OK)
  @UseGuards(new PermissionGuard('write'))
  @UseGuards(new AccessGuard(['level_3']))
  fundWallet(@GetCompany() company: Company, @Body() dto: FundWalletDto) {
    return this.walletService.fundWallet(dto, company);
  }

  @Get('card-payment/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(new PermissionGuard('write'))
  @UseGuards(new AccessGuard(['level_3']))
  cardPayment(
    @Param('id') id: string,
    @GetCompany() company: Company,
    @Body() dto: FundWalletDto,
  ) {
    return this.walletService.cardPayment(id, dto, company);
  }
}
