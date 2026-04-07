import { Module } from '@nestjs/common';
import { AdminClientsController } from './controller/clients.controller';
import { AdminOrganizationController } from './controller/organization.controller';
import { AdminStatisticsController } from './controller/statistics.controller';
import { AdminTeamController } from './controller/team.controller';
import { ClientsService } from './service/clients.service';
import { OrganizationService } from './service/organization.service';
import { StatisticsService } from './service/statistics.service';
import { TeamService } from './service/team.service';

@Module({
  providers: [
    TeamService,
    OrganizationService,
    ClientsService,
    StatisticsService,
  ],
  controllers: [
    AdminTeamController,
    AdminOrganizationController,
    AdminClientsController,
    AdminStatisticsController,
  ],
})
export class AdminModule {}
