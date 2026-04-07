import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Company } from '@prisma/client';
import { AccessGuard, CompanyGuard, PermissionGuard } from '../../auth/guard';
import { GetCompany } from '../decorator';
import {
  ChangeUsersStatus,
  CompanyUserStatisticsDto,
  UserListDto,
} from '../dto';
import { UsersService } from '../service/users.service';

@Controller({ version: '1', path: 'client/users' })
@UseGuards(CompanyGuard)
export class CompanyUsersController {
  constructor(private userService: UsersService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  getUserList(@GetCompany() company: Company, @Query() params: UserListDto) {
    return this.userService.getUsers(params, company);
  }

  @Get('statistics')
  @HttpCode(HttpStatus.OK)
  getStatistics(
    @GetCompany() company: Company,
    @Query() params: CompanyUserStatisticsDto,
  ) {
    return this.userService.getStatistics(params, company);
  }

  @Put('activate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(new PermissionGuard('write'))
  @UseGuards(new AccessGuard(['level_3']))
  activateUsers(
    @GetCompany() company: Company,
    @Body() body: ChangeUsersStatus,
  ) {
    return this.userService.activateUsers(body, company);
  }

  @Put('deactivate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(new PermissionGuard('write'))
  @UseGuards(new AccessGuard(['level_3']))
  deactivateUsers(
    @GetCompany() company: Company,
    @Body() body: ChangeUsersStatus,
  ) {
    return this.userService.deactivateUsers(body, company);
  }

  @Delete('delete/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(new PermissionGuard('delete'))
  @UseGuards(new AccessGuard(['level_3']))
  deleteUser(@Param('id') id: string, @GetCompany() company: Company) {
    return this.userService.deleteUser(id, company);
  }
}
