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
import { DurationDto, StatisticsDto } from '../dto';
import { StatisticsService } from '../service/statistics.service';

@Controller({ version: '1', path: 'client/statistics' })
@UseGuards(CompanyGuard)
export class CompanyStatisticsController {
  constructor(private statisticsService: StatisticsService) {}

  @Get('count')
  @HttpCode(HttpStatus.OK)
  getStatCount(@GetCompany() company: Company, @Query() params: StatisticsDto) {
    return this.statisticsService.getStatCount(params, company);
  }

  @Get('registered')
  @HttpCode(HttpStatus.OK)
  getRegUserCount(
    @GetCompany() company: Company,
    @Query() params: DurationDto,
  ) {
    return this.statisticsService.getRegUserCount(params, company);
  }

  @Get('login')
  @HttpCode(HttpStatus.OK)
  getLoginUserCount(
    @GetCompany() company: Company,
    @Query() params: DurationDto,
  ) {
    return this.statisticsService.getLoginUserCount(params, company);
  }
}
