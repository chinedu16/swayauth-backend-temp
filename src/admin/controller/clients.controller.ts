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
import { AccessGuard, PermissionGuard } from 'src/auth/guard';
import { AdminGuard } from '../../auth/guard/admin.guard';
import { ChangeUsersStatus } from '../../client/dto';
import { ClientDto } from '../dto/client.dto';
import { ClientsService } from '../service/clients.service';

@Controller({ version: '1', path: 'admin/clients' })
@UseGuards(AdminGuard)
export class AdminClientsController {
  constructor(private clientsService: ClientsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  getClients(@Query() params: ClientDto) {
    return this.clientsService.getClients(params);
  }

  @Put('activate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(new PermissionGuard('write'))
  @UseGuards(new AccessGuard(['level_5']))
  activateClients(@Body() body: ChangeUsersStatus) {
    return this.clientsService.activateClients(body);
  }

  @Put('deactivate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(new PermissionGuard('write'))
  @UseGuards(new AccessGuard(['level_5']))
  deactivateClients(@Body() body: ChangeUsersStatus) {
    return this.clientsService.deactivateClients(body);
  }

  @Delete('delete/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(new PermissionGuard('delete'))
  @UseGuards(new AccessGuard(['level_5']))
  deleteClient(@Param('id') id: string) {
    return this.clientsService.deleteClient(id);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  getOneClient(@Param('id') id: string) {
    return this.clientsService.getOneClient(id);
  }
}
