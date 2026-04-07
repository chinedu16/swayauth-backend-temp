import { $Enums } from '@prisma/client';
import {
  Contains,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsPhoneNumber,
  IsString,
} from 'class-validator';

export enum CreateTeamAccessEnumAdmin {
  level_4 = 'level_4',
  level_5 = 'level_5',
}
export class PermissionsDtoAdmin {
  @IsNotEmpty()
  @IsEnum(CreateTeamAccessEnumAdmin)
  access: CreateTeamAccessEnumAdmin;

  @IsNotEmpty()
  @IsEnum($Enums.permissions, { each: true })
  permissions: $Enums.permissions[];
}

export class CreateAdminTeamDto extends PermissionsDtoAdmin {
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
