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
  Length,
  MinLength,
} from 'class-validator';

export enum CreateUserAccessEnum {
  level_1 = 'level_2',
  level_2 = 'level_3',
}

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'password must be at least 6 characters' })
  password: string;
}

export class ForgetPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class TotpEnableDto {
  @IsNotEmpty()
  @IsEnum($Enums.two_factor_type)
  type: $Enums.two_factor_type;
}

export class TotpBaseDto {
  @IsNumberString()
  @IsNotEmpty()
  @Length(6, 6)
  token: string;

  @IsString()
  @IsNotEmpty()
  reference: string;
}

export class TotpDto extends TotpBaseDto {
  @IsString()
  @IsOptional()
  @MinLength(6, { message: 'password must be at least 6 characters' })
  password?: string;
}

export class ChangePasswordDto extends TotpDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'password must be at least 6 characters' })
  password: string;
}

export class RegisterParamsDto {
  @IsString()
  @IsNotEmpty()
  @Contains('.organization')
  client_id?: string;
}

export class RegisterDto extends LoginDto {
  @IsString()
  @IsOptional()
  first_name?: string;

  @IsString()
  @IsOptional()
  last_name?: string;

  @IsOptional()
  @IsPhoneNumber()
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
  @IsOptional()
  photo?: string;
}

export class RegisterClientDto extends RegisterDto {
  @IsString()
  @IsOptional()
  company_name?: string;
}
