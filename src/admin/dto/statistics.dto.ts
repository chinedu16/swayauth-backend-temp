import { IsOptional } from 'class-validator';
import { DurationDto } from '../../client/dto';

export class AdminStatisticsDto extends DurationDto {
  @IsOptional()
  revenue?: number;

  @IsOptional()
  clients?: number;

  @IsOptional()
  users?: number;

  @IsOptional()
  allClients?: number;
}
