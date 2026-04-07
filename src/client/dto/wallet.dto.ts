import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class FundWalletDto {
  @IsNumber()
  @IsNotEmpty()
  @Min(100)
  amount: number;
}

export class SaveCardsDto {
  @IsBoolean({ message: 'status must be one of true or false' })
  @Transform((value) => JSON.parse(value.value))
  status: boolean;
}
