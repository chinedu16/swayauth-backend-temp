import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Company } from '@prisma/client';
import { AccessGuard, CompanyGuard, PermissionGuard } from '../../auth/guard';
import { GetCompany } from '../decorator';
import { CredentialsService } from '../service/credentials.service';

@Controller({ version: '1', path: 'client/credentials' })
@UseGuards(CompanyGuard)
export class CompanyCredentialsController {
  constructor(private credentialService: CredentialsService) {}

  @Put('app-key/rotate')
  @UseGuards(new PermissionGuard('write'))
  @UseGuards(new AccessGuard(['level_3']))
  @HttpCode(HttpStatus.OK)
  rotateKey(@GetCompany() company: Company) {
    return this.credentialService.rotateKey(company);
  }

  @Get('app-key')
  @UseGuards(new AccessGuard(['level_3']))
  @HttpCode(HttpStatus.OK)
  getUserList(@GetCompany() company: Company) {
    return this.credentialService.getAppKey(company);
  }

  @Post('jwt')
  @HttpCode(HttpStatus.OK)
  jwtVerify(@Body('jwt') jwt: string) {
    return this.credentialService.jwtVerify(jwt);
  }
}
