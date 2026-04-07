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
  UseGuards,
} from '@nestjs/common';
import { Company } from '@prisma/client';
import { JWTProp } from 'src/auth/type';
import { AccessGuard, CompanyGuard, PermissionGuard } from '../../auth/guard';
import { GetUser } from '../../user/decorator';
import { GetCompany } from '../decorator';
import { CreateTeamDto, PermissionsDto, TeamListDto } from '../dto';
import { TeamService } from '../service/team.service';

@Controller({ version: '1', path: 'client/team' })
@UseGuards(CompanyGuard)
export class CompanyTeamController {
  constructor(private teamService: TeamService) {}

  @Get()
  @HttpCode(HttpStatus.CREATED)
  getTeam(
    @GetCompany() company: Company,
    @GetUser() user: JWTProp | null,
    @Query() params: TeamListDto,
  ) {
    return this.teamService.getTeam(params, user, company);
  }

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(new PermissionGuard('write'))
  @UseGuards(new AccessGuard(['level_3']))
  addTeam(@Body() dto: CreateTeamDto, @GetCompany() company: Company) {
    return this.teamService.addTeam(dto, company);
  }

  @Delete(':id')
  @UseGuards(new PermissionGuard('delete'))
  @UseGuards(new AccessGuard(['level_3']))
  @HttpCode(HttpStatus.OK)
  deleteTeamMember(@GetCompany() company: Company, @Param('id') id: string) {
    return this.teamService.deleteTeamMember(id, company);
  }

  @Patch('permission/:id')
  @UseGuards(new PermissionGuard('write'))
  @UseGuards(new AccessGuard(['level_3']))
  @HttpCode(HttpStatus.OK)
  changePermission(
    @Body() dto: PermissionsDto,
    @GetCompany() company: Company,
    @Param('id') id: string,
  ) {
    return this.teamService.changePermission(dto, id, company);
  }
}
