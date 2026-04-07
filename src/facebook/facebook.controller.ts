import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ClientIdDto } from './dto/facebook.dto';
import { FacebookService } from './facebook.service';
import { FacebookCodeResponseProp } from './type/facebook.type';

@Controller({ version: '1', path: 'facebook' })
export class FacebookController {
  constructor(private facebookService: FacebookService) {}

  @Get('oauth')
  googleAuth(@Query() params: ClientIdDto) {
    return this.facebookService.authentication(params);
  }

  @Get('response')
  async googleResponse(
    @Res() res: Response,
    @Query() params: FacebookCodeResponseProp,
  ) {
    const response = await this.facebookService.getBasicInfo(params);
    return res.redirect(response);
  }
}
