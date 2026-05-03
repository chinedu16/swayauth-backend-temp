import { $Enums } from '@prisma/client';
import {
  Contains,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsPhoneNumber,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { DirectionEnum } from 'src/common/dto/base';

export enum CreateTeamAccessEnum {
  level_2 = 'level_2',
  level_3 = 'level_3',
}
export enum CreateTeamAccessEnumAdmin {
  level_4 = 'level_4',
  level_5 = 'level_5',
}

export class RegisterParamsDto {
  @IsString()
  @IsNotEmpty()
  @Contains('.organization')
  client_id?: string;
}

export class PermissionsDto {
  @IsNotEmpty()
  @IsEnum(CreateTeamAccessEnum)
  access: CreateTeamAccessEnum;

  @IsNotEmpty()
  @IsEnum($Enums.permissions, { each: true })
  permissions: $Enums.permissions[];
}

export class PermissionsDtoAdmin {
  @IsNotEmpty()
  @IsEnum(CreateTeamAccessEnumAdmin)
  access: CreateTeamAccessEnumAdmin;

  @IsNotEmpty()
  @IsEnum($Enums.permissions, { each: true })
  permissions: $Enums.permissions[];
}

export class CreateTeamDto extends PermissionsDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  first_name?: string;

  @IsString()
  @IsOptional()
  last_name?: string;

  @IsNumberString()
  @IsPhoneNumber()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @Contains('https')
  @IsOptional()
  photo?: string;
}

enum OrderByEnum {
  id = 'id',
  first_name = 'first_name',
  last_name = 'last_name',
  email = 'email',
  status = 'status',
  created_at = 'created_at',
  address = 'address',
  city = 'city',
  state = 'state',
  country = 'country',
}

export class TeamListDto {
  @IsEnum(OrderByEnum, {
    message:
      'order_by must be one of the following values: id, first_name, last_name, email, organization, status, created_at, address, city, state, country',
  })
  @IsOptional()
  order_by?: OrderByEnum = OrderByEnum.id;

  @IsEnum(DirectionEnum, {
    message: 'direction must be one of the following values: asc, desc',
  })
  @IsOptional()
  direction?: DirectionEnum = DirectionEnum.asc;

  @IsString()
  @IsOptional()
  search?: string;

  @IsOptional()
  @IsNumber()
  @Transform((value) => value.value * 1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Transform((value) => value.value * 1)
  size?: number = 10;
}
