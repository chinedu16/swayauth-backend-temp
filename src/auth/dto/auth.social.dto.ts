import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum Alert {
  off = 'off',
  on = 'on',
}

export class SocialDtop {
  @IsNotEmpty()
  @IsString()
  client_id: string;

  @IsOptional()
  @IsEnum(Alert, {
    message: 'alert must be one of the following values: off, on',
  })
  alert: Alert = Alert.on;
}
