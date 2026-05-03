import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ClientIdDto {
  @IsNotEmpty()
  @IsString()
  client_id: string;
}

export class GoogleDto {
  @IsString()
  @IsOptional()
  scope: string;

  @IsString()
  @IsOptional()
  code: string;
}
