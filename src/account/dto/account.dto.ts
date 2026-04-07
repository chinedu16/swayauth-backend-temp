import {
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MinLength,
} from 'class-validator';

export class BaseAccountDto {
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
}

export class EditUserProfileDto extends BaseAccountDto {
  @IsString()
  @IsOptional()
  photo?: string;

  @IsString()
  @IsOptional()
  first_name?: string;

  @IsString()
  @IsOptional()
  company_name?: string;

  @IsString()
  @IsOptional()
  company_bio?: string;

  @IsString()
  @IsOptional()
  last_name?: string;

  @IsString()
  @IsPhoneNumber()
  @IsOptional()
  phone?: string;
}

export class EditPassword {
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'password must be at least 6 characters' })
  old_password: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'password must be at least 6 characters' })
  new_password: string;
}

export class EditCompanyProfileDto extends BaseAccountDto {
  @IsString()
  @IsOptional()
  name?: string;
}
