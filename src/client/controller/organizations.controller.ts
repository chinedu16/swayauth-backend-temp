import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Company } from '@prisma/client';
import { AccessGuard, CompanyGuard, PermissionGuard } from '../../auth/guard';
import { ImageInterceptor } from '../../common';
import { GetCompany } from '../decorator';
import {
  CreateEditOrganization,
  CreateEditOrganizationTokenDto,
  DeleteOrganizationTokenDto,
  OrganizationListDto,
} from '../dto/organizations.dto';
import { OrganizationsService } from '../service/organizations.service';

@Controller({ version: '1', path: 'client/organizations' })
@UseGuards(CompanyGuard)
export class CompanyOrganizationsController {
  constructor(private organizationService: OrganizationsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  getOrganizationList(
    @GetCompany() company: Company,
    @Query() params: OrganizationListDto,
  ) {
    return this.organizationService.getOrganizationList(params, company);
  }

  @Post('create')
  @UseGuards(new PermissionGuard('write'))
  @UseGuards(new AccessGuard(['level_3']))
  @HttpCode(HttpStatus.OK)
  createOrganization(
    @GetCompany() company: Company,
    @Body() params: CreateEditOrganization,
  ) {
    return this.organizationService.createOrganization(params, company);
  }

  @Delete('tokens')
  @HttpCode(HttpStatus.OK)
  deleteOrganizationToken(
    @GetCompany() company: Company,
    @Body() dto: DeleteOrganizationTokenDto,
  ) {
    return this.organizationService.deleteOrganizationToken(dto, company);
  }

  @Patch('tokens/:id')
  @HttpCode(HttpStatus.CREATED)
  editOrganizationToken(
    @GetCompany() company: Company,
    @Param('id') id: string,
    @Body() dto: CreateEditOrganizationTokenDto,
  ) {
    return this.organizationService.editOrganizationToken(id, dto, company);
  }

  @Patch(':id/photo')
  @UseGuards(new PermissionGuard('write'))
  @UseGuards(new AccessGuard(['level_2', 'level_3']))
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(ImageInterceptor)
  changeOrganizationPhoto(
    @GetCompany() company: Company,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.organizationService.changeOrganizationPhoto(id, file, company);
  }

  @Get(':id/tokens')
  @HttpCode(HttpStatus.OK)
  getOrganizationTokens(
    @GetCompany() company: Company,
    @Param('id') id: string,
    @Query() params: OrganizationListDto,
  ) {
    return this.organizationService.getOrganizationTokens(id, params, company);
  }

  @Post(':id/tokens')
  @HttpCode(HttpStatus.CREATED)
  createOrganizationToken(
    @GetCompany() company: Company,
    @Param('id') id: string,
    @Body() dto: CreateEditOrganizationTokenDto,
  ) {
    return this.organizationService.createOrganizationToken(id, dto, company);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  getOneOrganization(@GetCompany() company: Company, @Param('id') id: string) {
    return this.organizationService.getOneOrganization(id, company);
  }

  @Patch(':id')
  @UseGuards(new PermissionGuard('write'))
  @UseGuards(new AccessGuard(['level_2', 'level_3']))
  @HttpCode(HttpStatus.OK)
  editOrganization(
    @GetCompany() company: Company,
    @Body() params: CreateEditOrganization,
    @Param('id') id: string,
  ) {
    return this.organizationService.editOrganization(id, params, company);
  }

  @Delete(':id')
  @UseGuards(new PermissionGuard('delete'))
  @UseGuards(new AccessGuard(['level_3']))
  @HttpCode(HttpStatus.OK)
  deleteOrganization(@GetCompany() company: Company, @Param('id') id: string) {
    return this.organizationService.deleteOrganization(id, company);
  }
}
