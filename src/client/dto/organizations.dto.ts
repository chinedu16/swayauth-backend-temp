import { $Enums } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  NotContains,
} from 'class-validator';

enum OrderByEnum {
  id = 'id',
  name = 'first_name',
  created_at = 'last_name',
  organization_token = 'organization_token',
}

enum DirectionEnum {
  asc = 'asc',
  desc = 'desc',
}

export type OrganizationTokenTemplate = 'classic' | 'modern' | 'minimal';

export class CreateEditOrganization {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @Matches(/^(https:\/\/|http:\/\/).*$/, {
    message: 'photo must contain https:// in string',
  })
  @IsOptional()
  photo?: string;

  @IsString()
  @IsNotEmpty()
  @Transform((value) => value.value.toLowerCase())
  @NotContains('swayauth.com')
  website: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsNotEmpty()
  bio: string;
}

export class DeleteOrganizationTokenDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  token_ids: string[];
}

export class CreateEditOrganizationTokenDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(['classic', 'modern', 'minimal'], {
    message: 'template must be one of: classic, modern, minimal',
  })
  @IsOptional()
  template?: OrganizationTokenTemplate;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Transform((value) => value.value.map((o: string) => o.toLowerCase()))
  @NotContains('swayauth.com', { each: true })
  origins?: string[];

  @IsString()
  @IsOptional()
  @Transform((value) => value.value.toLowerCase())
  @NotContains('swayauth.com')
  redirect_url?: string;

  @IsEnum($Enums.scope, { each: true })
  @IsOptional()
  scope: $Enums.scope[];

  @IsEnum($Enums.two_factor_type, { each: true })
  @IsOptional()
  two_factor_type: $Enums.two_factor_type[] = [];

  @IsBoolean()
  @IsOptional()
  verify_registration?: boolean;

  @IsEnum($Enums.verify_registration_type)
  @IsOptional()
  verify_registration_type?: $Enums.verify_registration_type;

  @IsEnum($Enums.permissions, { each: true })
  permissions?: $Enums.permissions[];
}

export class OrganizationListBaseDto {
  @IsOptional()
  @IsNumber()
  @Min(-1)
  @Transform((value) => value.value * 1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Transform((value) => value.value * 1)
  size?: number = 10;
}

export class OrganizationListDto extends OrganizationListBaseDto {
  @IsEnum(OrderByEnum, {
    message:
      'order_by must be one of the following values: id, name, organization_token, created_at',
  })
  @IsOptional()
  order_by?: OrderByEnum = OrderByEnum.id;

  @IsEnum(DirectionEnum, {
    message: 'direction must be one of the following values: asc, desc',
  })
  @IsOptional()
  direction?: DirectionEnum = DirectionEnum.asc;
}
