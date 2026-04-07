import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../auth/guard/admin.guard';
import { DurationDto } from '../../client/dto';
import { AdminStatisticsDto } from '../dto';
import { StatisticsService } from '../service/statistics.service';

@Controller({ version: '1', path: 'admin/statistics' })
@UseGuards(AdminGuard)
export class AdminStatisticsController {
  constructor(private statisticsService: StatisticsService) {}

  @Get('count')
  @HttpCode(HttpStatus.OK)
  getStatCount(@Query() params: AdminStatisticsDto) {
    return this.statisticsService.getStatCount(params);
  }

  @Get('clients')
  @HttpCode(HttpStatus.OK)
  getClientCount(@Query() params: DurationDto) {
    return this.statisticsService.getClientCount(params);
  }

  @Get('integration')
  @HttpCode(HttpStatus.OK)
  getIntegrationCount(@Query() params: DurationDto) {
    return this.statisticsService.getIntegrationCount(params);
  }

  @Get('recent-clients')
  @HttpCode(HttpStatus.OK)
  getRecentClients() {
    return this.statisticsService.getRecentClients();
  }
}
