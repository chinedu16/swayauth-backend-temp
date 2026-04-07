import { $Enums } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsNumber, Min, IsString } from 'class-validator';

enum OrderByEnum {
  id = 'id',
  created_at = 'created_at',
}

export enum DirectionEnum {
  asc = 'asc',
  desc = 'desc',
}

export class ListDto {
  @IsEnum(OrderByEnum, {
    message:
      'order_by must be one of the following values: id, first_name, last_name, email, organization, status, created_at, address, city, state, country',
  })
  @IsOptional()
  order_by?: OrderByEnum = OrderByEnum.id;

  @IsOptional()
  url?: string;

  @IsOptional()
  status?: $Enums.status;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform((value) => value.value * 1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Transform((value) => value.value * 1)
  size?: number = 10;

  @IsEnum(DirectionEnum, {
    message: 'direction must be one of the following values: asc, desc',
  })
  @IsOptional()
  direction?: DirectionEnum = DirectionEnum.desc;

  @IsString()
  @IsOptional()
  search?: string;
}
