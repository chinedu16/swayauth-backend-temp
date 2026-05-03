import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { OrganizationsService } from '../service/organizations.service';

@Controller({ version: '1', path: 'client/organizations/tokens' })
export class PublicOrganizationTokensController {
  constructor(private organizationService: OrganizationsService) {}

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  getOrganizationToken(@Param('id') id: string) {
    return this.organizationService.getOrganizationTokenPublic(id);
  }
}
