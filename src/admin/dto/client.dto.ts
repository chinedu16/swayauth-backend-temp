import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsNumber, Min, IsString } from 'class-validator';
import { DirectionEnum } from 'src/common/dto/base';

enum OrderByEnum {
  id = 'id',
  name = 'name',
  email = 'email',
  status = 'status',
  created_at = 'created_at',
  address = 'address',
  city = 'city',
  state = 'state',
  wallet = 'wallet',
  country = 'country',
}

export class ClientDto {
  @IsEnum(OrderByEnum, {
    message:
      'order_by must be one of the following values: id, wallet, email, organization, status, created_at, address, city, state, country',
  })
  @IsOptional()
  order_by?: OrderByEnum = OrderByEnum.id;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform((value) => value.value * 1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Transform((value) => value.value * 1)
  size?: number = 10;

  @IsEnum(DirectionEnum, {
    message: 'direction must be one of the following values: asc, desc',
  })
  @IsOptional()
  direction?: DirectionEnum = DirectionEnum.asc;

  @IsString()
  @IsOptional()
  search?: string;
}
