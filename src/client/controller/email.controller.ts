import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Company } from '@prisma/client';
import { AccessGuard, CompanyGuard, PermissionGuard } from '../../auth/guard';
import { GetCompany } from '../decorator';
import { SmtpDto, SmtpVerifyDto } from '../dto';
import { CompanyEmailService } from '../service/email.service';
import { ImageInterceptor } from 'src/common';

@Controller({ version: '1', path: 'client/mail' })
@UseGuards(CompanyGuard)
export class CompanyEmailController {
  constructor(private emailService: CompanyEmailService) {}

  @Post('setup')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(new PermissionGuard('write'))
  @UseGuards(new AccessGuard(['level_3']))
  setupSMTP(@GetCompany() company: Company, @Body() dto: SmtpDto) {
    return this.emailService.setupSMTP(dto, company);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  getSMTP(@GetCompany() company: Company) {
    return this.emailService.getSMTP(company);
  }

  @Patch('photo')
  @UseInterceptors(ImageInterceptor)
  @HttpCode(HttpStatus.OK)
  uploadPhoto(
    @GetCompany() company: Company,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.emailService.uploadPhoto(company, file);
  }

  @Put('verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(new PermissionGuard('write'))
  @UseGuards(new AccessGuard(['level_3']))
  verifySMTP(@GetCompany() company: Company, @Body() dto: SmtpVerifyDto) {
    return this.emailService.verifySMTP(dto, company);
  }

  @Patch('update')
  @HttpCode(HttpStatus.OK)
  @UseGuards(new PermissionGuard('write'))
  @UseGuards(new AccessGuard(['level_3']))
  updateSMTP(@GetCompany() company: Company, @Body() dto: SmtpDto) {
    return this.emailService.updateSMTP(dto, company);
  }

  @Delete('delete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(new PermissionGuard('delete'))
  @UseGuards(new AccessGuard(['level_3']))
  deleteSMTP(@GetCompany() company: Company) {
    return this.emailService.deleteSMTP(company);
  }
}
