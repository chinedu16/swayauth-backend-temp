import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Company } from '@prisma/client';
import { CompanyGuard } from '../../auth/guard';
import { GetCompany } from '../decorator';
import { TransactionListDto } from '../dto/transactions.dto';
import { TransactionService } from '../service/transaction.service';

@Controller({ version: '1', path: 'client/transactions' })
@UseGuards(CompanyGuard)
export class CompanyTransactionsController {
  constructor(private transactionService: TransactionService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  getTransactions(
    @GetCompany() company: Company,
    @Query() params: TransactionListDto,
  ) {
    return this.transactionService.getTransactions(params, company);
  }
}
