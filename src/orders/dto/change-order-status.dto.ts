import { OrderStatusList } from '@/orders/enum';
import { OrderStatus } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class ChangeOrderStatusDto {
  @IsUUID()
  id: string;

  @IsEnum(OrderStatusList, {
    message: (args) =>
      `#${args.value} is not a valid order status. Possible values: ${OrderStatusList.join(
        ', ',
      )}`,
  })
  status: OrderStatus;
}
