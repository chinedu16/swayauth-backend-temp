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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AccessGuard, PermissionGuard } from '../../auth/guard';
import { AdminGuard } from '../../auth/guard/admin.guard';
import { JWTProp } from '../../auth/type';
import {
  ChangeUsersStatus,
  PermissionsDtoAdmin,
  TeamListDto,
} from '../../client/dto';
import { GetUser } from '../../user/decorator';
import { CreateAdminTeamDto } from '../dto/team.dto';
import { TeamService } from '../service/team.service';

@Controller({ version: '1', path: 'admin/team' })
@UseGuards(AdminGuard)
export class AdminTeamController {
  constructor(private teamService: TeamService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  getTeam(@GetUser() user: JWTProp, @Query() params: TeamListDto) {
    return this.teamService.getTeam(params, user);
  }

  @Get('count')
  @HttpCode(HttpStatus.OK)
  teamCount(@GetUser() user: JWTProp) {
    return this.teamService.teamCount(user);
  }

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(new PermissionGuard('write'))
  @UseGuards(new AccessGuard(['level_5']))
  addTeam(@Body() dto: CreateAdminTeamDto) {
    return this.teamService.addTeam(dto);
  }

  @Put('activate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(new PermissionGuard('write'))
  @UseGuards(new AccessGuard(['level_5']))
  activateTeam(@GetUser() user: JWTProp, @Body() body: ChangeUsersStatus) {
    return this.teamService.activateTeam(body, user);
  }

  @Put('deactivate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(new PermissionGuard('write'))
  @UseGuards(new AccessGuard(['level_5']))
  deactivateTeam(@GetUser() user: JWTProp, @Body() body: ChangeUsersStatus) {
    return this.teamService.deactivateTeam(body, user);
  }

  @Delete('delete/:id')
  @UseGuards(new PermissionGuard('delete'))
  @UseGuards(new AccessGuard(['level_5']))
  @HttpCode(HttpStatus.OK)
  deleteTeamMember(@GetUser() user: JWTProp, @Param('id') id: string) {
    return this.teamService.deleteTeamMember(id, user);
  }

  @Patch('permission/:id')
  @UseGuards(new PermissionGuard('write'))
  @UseGuards(new AccessGuard(['level_5']))
  @HttpCode(HttpStatus.OK)
  changePermission(@Body() dto: PermissionsDtoAdmin, @Param('id') id: string) {
    return this.teamService.changePermission(dto, id);
  }
}
