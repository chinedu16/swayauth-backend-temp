import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  status() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    };
  }
}
