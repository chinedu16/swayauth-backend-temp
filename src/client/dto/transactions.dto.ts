import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class TransactionListDto {
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
