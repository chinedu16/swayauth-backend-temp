import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Patch,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Company } from '@prisma/client';
import { JWTProp } from '../auth/type';
import { GetCompany } from '../client/decorator';
import { ImageInterceptor } from '../common';
import { GetClient, GetUser } from '../user/decorator';
import {
  AccessGuard,
  ClientGuard,
  CompanyGuard,
  PermissionGuard,
  UserGuard,
} from '../auth/guard';
import { AccountService } from './account.service';
import {
  EditCompanyProfileDto,
  EditPassword,
  EditUserProfileDto,
} from './dto/account.dto';

@Controller({ version: '1', path: 'account' })
export class AccountController {
  constructor(private accountService: AccountService) {}

  @Get()
  @UseGuards(UserGuard)
  @HttpCode(HttpStatus.OK)
  getProfile(@GetUser() user: JWTProp) {
    return this.accountService.getProfile(user);
  }

  @Patch()
  @UseGuards(UserGuard)
  @HttpCode(HttpStatus.OK)
  editUserProfile(
    @Body() dto: EditUserProfileDto,
    @GetUser() user: JWTProp,
    @Ip() ip_address: string,
  ) {
    return this.accountService.editUserProfile(dto, user, ip_address);
  }

  @Patch('photo')
  @UseGuards(UserGuard)
  @UseInterceptors(ImageInterceptor)
  @HttpCode(HttpStatus.OK)
  changeUserPhoto(
    @GetUser() user: JWTProp,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.accountService.changePhoto(user, false, file);
  }

  @Patch('password')
  @UseGuards(UserGuard)
  @HttpCode(HttpStatus.OK)
  editUserPassword(
    @Body() dto: EditPassword,
    @GetUser() user: JWTProp,
    @Ip() ip_address: string,
  ) {
    return this.accountService.editUserPassword(dto, user, ip_address);
  }

  @Put('switch/:id')
  @UseGuards(ClientGuard)
  @HttpCode(HttpStatus.OK)
  switchClientAccount(
    @Param('id') id: string,
    @GetClient() client: JWTProp,
    @Ip() ip_address: string,
  ) {
    return this.accountService.switchClientAccount(id, client, ip_address);
  }

  @Get('association')
  @UseGuards(ClientGuard)
  @HttpCode(HttpStatus.OK)
  getAssocAccounts(@GetClient() client: JWTProp) {
    return this.accountService.getAssocAccounts(client);
  }

  @Get('company')
  @UseGuards(CompanyGuard)
  @HttpCode(HttpStatus.OK)
  getCompanyProfile(@GetCompany() company: Company) {
    return company;
  }

  @Patch('company')
  @UseGuards(new PermissionGuard('write'))
  @UseGuards(new AccessGuard(['level_3']))
  @UseGuards(CompanyGuard)
  @HttpCode(HttpStatus.OK)
  editCompanyProfile(
    @Body() dto: EditCompanyProfileDto,
    @GetCompany() company: Company,
  ) {
    return this.accountService.editCompanyProfile(dto, company);
  }
}
