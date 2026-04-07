import { Module } from '@nestjs/common';
import { CompanyCardsController } from './controller/cards.controller';
import { CompanyCredentialsController } from './controller/credentials.controller';
import { CompanyEmailController } from './controller/email.controller';
import { CompanyOrganizationsController } from './controller/organizations.controller';
import { CompanyStatisticsController } from './controller/statistics.controller';
import { CompanyTeamController } from './controller/team.controller';
import { CompanyTransactionsController } from './controller/transactions.controller';
import { CompanyUsersController } from './controller/users.controller';
import { CompanyWalletController } from './controller/wallet.controller';
import { CardsService } from './service/cards.service';
import { CredentialsService } from './service/credentials.service';
import { CompanyEmailService } from './service/email.service';
import { OrganizationsService } from './service/organizations.service';
import { StatisticsService } from './service/statistics.service';
import { TeamService } from './service/team.service';
import { UsersService } from './service/users.service';
import { WalletService } from './service/wallet.service';
import { TransactionService } from './service/transaction.service';

@Module({
  providers: [
    TeamService,
    StatisticsService,
    CardsService,
    TransactionService,
    CredentialsService,
    CompanyEmailService,
    OrganizationsService,
    UsersService,
    WalletService,
  ],
  controllers: [
    CompanyEmailController,
    CompanyCardsController,
    CompanyCredentialsController,
    CompanyOrganizationsController,
    CompanyStatisticsController,
    CompanyTeamController,
    CompanyTransactionsController,
    CompanyUsersController,
    CompanyWalletController,
  ],
})
export class ClientModule {}
