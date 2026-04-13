import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export enum OAuthGrantType {
  authorization_code = 'authorization_code',
  refresh_token = 'refresh_token',
}

export class OAuthAuthorizeDto {
  @IsString()
  client_id: string;

  @IsString()
  redirect_uri: string;

  @IsString()
  code_challenge: string;

  @IsString()
  @IsOptional()
  code_challenge_method?: string = 'S256';

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  scope?: string;

  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class OAuthTokenDto {
  @IsEnum(OAuthGrantType)
  grant_type: OAuthGrantType;

  @IsString()
  client_id: string;

  @IsString()
  @IsOptional()
  redirect_uri?: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  code_verifier?: string;

  @IsString()
  @IsOptional()
  refresh_token?: string;
}

export class OAuthRevokeDto {
  @IsString()
  @IsOptional()
  token?: string;

  @IsString()
  @IsOptional()
  token_type_hint?: string;
}

export class OAuthIntrospectDto {
  @IsString()
  token: string;
}

export class OAuthRegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  password: string;

  @IsString()
  @IsOptional()
  first_name?: string;

  @IsString()
  @IsOptional()
  last_name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  client_id: string;
}

export class PasswordResetRequestDto {
  @IsEmail()
  email: string;

  @IsString()
  client_id: string;
}

export class PasswordResetConfirmDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  new_password: string;

  @IsString()
  reset_token: string;

  @IsString()
  client_id: string;
}

export class PasswordResetVerifyDto {
  @IsString()
  reset_token: string;

  @IsEmail()
  email: string;

  @IsString()
  client_id: string;
}
