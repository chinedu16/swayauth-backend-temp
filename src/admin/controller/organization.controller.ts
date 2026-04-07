import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserListDto } from 'src/client/dto';
import { AdminGuard } from '../../auth/guard/admin.guard';
import { OrganizationListBaseDto } from '../../client/dto/organizations.dto';
import { OrganizationService } from '../service/organization.service';

@Controller({ version: '1', path: 'admin/organizations' })
@UseGuards(AdminGuard)
export class AdminOrganizationController {
  constructor(private organizationService: OrganizationService) {}

  @Get(':id/tokens')
  @HttpCode(HttpStatus.OK)
  getOneOrganizationTokens(
    @Param('id') id: string,
    @Query() params: OrganizationListBaseDto,
  ) {
    return this.organizationService.getOneOrganizationTokens(id, params);
  }

  @Get(':id/users')
  @HttpCode(HttpStatus.OK)
  getOneOrganizationUserList(
    @Param('id') id: string,
    @Query() params: UserListDto,
  ) {
    return this.organizationService.getOneOrganizationUserList(id, params);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  getOneOrganization(@Param('id') id: string, @Query('users') users?: string) {
    return this.organizationService.getOneOrganization(id, users);
  }
}
