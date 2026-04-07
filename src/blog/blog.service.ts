import { Injectable, NotFoundException } from '@nestjs/common';
import { JWTProp } from '../auth/type';
import { CONST } from '../common';
import { ListDto } from '../common/dto/base';
import { PrismaService } from '../prisma/prisma.service';
import { BlogCreateDto } from './blog.dto';
import { Blog, Prisma } from '@prisma/client';

@Injectable()
export class BlogService {
  constructor(private prisma: PrismaService) {}

  async editBlog(id: string, dto: BlogCreateDto, user: JWTProp) {
    return await this.prisma.blog.update({
      where: { url: id },
      data: {
        ...dto,
        admin_id: user.sub,
      },
    });
  }

  async createBlog(dto: BlogCreateDto, user: JWTProp) {
    const url = dto.title.replace(/[\W_]+/g, '-') + '-' + Date.now();
    return await this.prisma.blog.create({
      data: {
        ...dto,
        url,
        admin_id: user.sub,
      },
    });
  }

  async deleteBlog(id: string) {
    await this.prisma.blog.delete({
      where: { id },
    });
    return { message: CONST.RESPONSE.PROCESSED_SUCCESSULLY };
  }

  async getOneBlog(url: string, s?: string) {
    const status = s ? { status: s } : {};
    const blog = await this.prisma.blog.findFirst({
      where: {
        url,
        ...(status as any),
      },
    });

    if (!blog) throw new NotFoundException('Blog could not be found');

    const next = await this.prisma.blog.findMany({
      where: {
        created_at: {
          gt: new Date(blog.created_at),
        },
        status: 'active',
      },
      select: {
        photo: true,
        title: true,
        url: true,
        sub_title: true,
      },
      take: 10,
    });

    return { blog, next };
  }

  async getBlogsCount(status?: string) {
    return this.prisma.blog.count(
      status ? { where: { status: 'active' } } : ({} as any),
    );
  }

  async getBlogs(params: ListDto) {
    const status = params?.status ? { status: params?.status } : {};
    const where =
      typeof params?.url != 'undefined'
        ? {
            url: params?.url,
            ...status,
          }
        : ({
            AND: [
              {
                OR: [
                  {
                    url: {
                      contains: params.search,
                      mode: 'insensitive',
                    },
                  },
                  params?.status
                    ? {
                        status: params?.status,
                      }
                    : {
                        content: {
                          contains: params.search,
                          mode: 'insensitive',
                        },
                      },
                  {
                    content: {
                      contains: params.search,
                      mode: 'insensitive',
                    },
                  },
                  {
                    title: {
                      contains: params.search,
                      mode: 'insensitive',
                    },
                  },
                  {
                    sub_title: {
                      contains: params.search,
                      mode: 'insensitive',
                    },
                  },
                ],
              },
            ],
          } as Prisma.BlogWhereInput);

    const combine: {
      data: Partial<Blog>[];
      total: number;
      page: number;
      size: number;
    } = {
      data: [],
      total: 0,
      page: params.page,
      size: params.size,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.blog.findMany({
        where,
        select: {
          id: true,
          photo: true,
          title: true,
          sub_title: true,
          url: true,
          status: true,
          created_at: true,
          updated_at: true,
        },
        orderBy: {
          [params.order_by]: params.direction,
        },
        skip: (params.page - 1) * params.size,
        take: params.size,
      }),
      this.prisma.blog.count({ where }),
    ]);

    return { ...combine, data, total };
  }
}
