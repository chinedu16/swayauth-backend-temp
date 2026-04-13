import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller()
export class DashboardController {
  @Get('dashboard')
  dashboard(@Query() query: any, @Res() res: Response) {
    // For testing, return the query params as JSON
    res.json({
      message: 'OAuth callback received',
      query,
    });
  }
}