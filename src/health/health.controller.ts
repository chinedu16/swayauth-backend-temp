import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller({ version: '1', path: 'health' })
export class HealthController {
  constructor(private healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  status() {
    return this.healthService.status();
  }
}
