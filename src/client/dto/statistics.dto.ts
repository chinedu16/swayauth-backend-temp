import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { DurationEnum } from '../../common';

export class DurationDto {
  @IsEnum(DurationEnum, {
    message:
      'duration must be one of the following values: 7_days, 14_days, 30_days, 6_months, 1_year ',
  })
  @IsOptional()
  duration?: DurationEnum = DurationEnum['7_days'];
}

export class StatisticsDto extends DurationDto {
  @IsOptional()
  users?: number;

  @IsOptional()
  sms?: number;

  @IsOptional()
  mail?: number;

  @IsOptional()
  google?: number;

  @IsOptional()
  facebook?: number;

  @IsOptional()
  manual?: number;
}

export class CompanyUserStatisticsDto {
  @IsOptional()
  users?: number;

  @IsOptional()
  organizations?: number;

  @IsOptional()
  active?: number;

  @IsOptional()
  disabled?: number;
}

export class ChangeUsersStatus {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  user_ids: string[];
}
