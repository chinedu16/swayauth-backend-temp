import {
  IsEmail,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUrl,
  Length,
} from 'class-validator';

export class SmtpDto {
  @IsString()
  @IsNotEmpty()
  company_name: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl()
  website: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  photo?: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  host: string;
}

export class SmtpVerifyDto {
  @IsNumberString()
  @IsNotEmpty()
  @Length(6, 6)
  token: string;

  @IsString()
  @IsNotEmpty()
  reference: string;
}
