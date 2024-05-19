import { OrderStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsPositive } from 'class-validator';
import { OrderStatusList } from '@/orders/enum';

export class PaginationDto {
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;

  @IsEnum(OrderStatusList, {
    message: (args) =>
      `${args.value} is not a valid order status. Possible values: ${OrderStatusList.join(
        ', ',
      )}`,
  })
  @IsOptional()
  status: OrderStatus = OrderStatus.PENDING;
}
