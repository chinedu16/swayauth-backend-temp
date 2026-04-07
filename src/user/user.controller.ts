import { Controller, Get, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { PermissionGuard, UserGuard } from '../auth/guard';
import { GetUser } from './decorator';

@UseGuards(UserGuard)
@Controller({ version: '1', path: 'users' })
export class UserController {
  @Get('me')
  @UseGuards(new PermissionGuard('write'))
  getMe(@GetUser() user: User) {
    return user;
  }
}
