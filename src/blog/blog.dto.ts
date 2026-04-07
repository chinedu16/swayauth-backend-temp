import { IsEnum, IsOptional, IsString } from 'class-validator';

enum BlogStatusEnum {
  active = 'active',
  diabled = 'disabled',
}
export class BlogCreateDto {
  @IsOptional()
  @IsEnum(BlogStatusEnum)
  status: BlogStatusEnum = BlogStatusEnum.active;

  @IsString()
  photo: string;

  @IsString()
  title: string;

  @IsString()
  sub_title: string;

  @IsString()
  content: string;
}
