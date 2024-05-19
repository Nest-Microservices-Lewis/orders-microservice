import { OrderStatus } from '@prisma/client';

export const OrderStatusList = [
  OrderStatus.CANCELED,
  OrderStatus.DELIVERED,
  OrderStatus.PENDING,
];
