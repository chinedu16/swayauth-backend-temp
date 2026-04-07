import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ClientIdDto } from './dto/google.dto';
import { GoogleService } from './google.service';
import { GoogleCodeResponseProp } from './type/google.type';

@Controller({ version: '1', path: 'google' })
export class GoogleController {
  constructor(private googleService: GoogleService) {}

  @Get('oauth')
  googleAuth(@Query() params: ClientIdDto) {
    return this.googleService.authentication(params);
  }

  @Get('response')
  async googleResponse(
    @Res() res: Response,
    @Query() params: GoogleCodeResponseProp,
  ) {
    const response = await this.googleService.getBasicInfo(params);
    return res.redirect(response);
  }
}
