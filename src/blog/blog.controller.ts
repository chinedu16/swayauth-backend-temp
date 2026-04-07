import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JWTProp } from 'src/auth/type';
import { GetUser } from 'src/user/decorator';
import { AdminGuard } from '../auth/guard/admin.guard';
import { ListDto } from '../common/dto/base';
import { BlogCreateDto } from './blog.dto';
import { BlogService } from './blog.service';

@Controller({ version: '1', path: 'blog' })
export class BlogController {
  constructor(private blogService: BlogService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  getBlogs(@Query() params: ListDto) {
    return this.blogService.getBlogs(params);
  }

  @Get('count')
  @HttpCode(HttpStatus.OK)
  getBlogsCount(@Query('status') status?: string) {
    return this.blogService.getBlogsCount(status);
  }

  @Post('create')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  createBlog(@GetUser() user: JWTProp, @Body() dto: BlogCreateDto) {
    return this.blogService.createBlog(dto, user);
  }

  @Delete('delete/:id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  deleteUser(@Param('id') id: string) {
    return this.blogService.deleteBlog(id);
  }

  @Put(':id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  editBlog(
    @Param('id') id: string,
    @GetUser() user: JWTProp,
    @Body() dto: BlogCreateDto,
  ) {
    return this.blogService.editBlog(id, dto, user);
  }

  @Get(':url')
  @HttpCode(HttpStatus.OK)
  getOneBlog(@Param('url') url: string, @Query('status') status?: string) {
    return this.blogService.getOneBlog(url, status);
  }
}
