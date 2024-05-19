import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ChangeOrderStatusDto, CreateOrderDto } from './dto';
import { PrismaClient } from '@prisma/client';
import { PaginationDto } from '@/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { NATS_SERVICE } from '@/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);

  constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async create(createOrderDto: CreateOrderDto) {
    try {
      const productIds = createOrderDto.items.map(({ productId }) => productId);
      const products = await this.getProductsByIds(productIds);

      const totalAmount = createOrderDto.items.reduce(
        (acc, { productId, quantity }) => {
          const price = products.find(({ id }) => id === productId).price;
          return acc + price * quantity;
        },
        0,
      );

      const totalItems = createOrderDto.items.reduce(
        (acc, { quantity }) => acc + quantity,
        0,
      );

      const order = await this.order.create({
        data: {
          totalAmount,
          totalItems,
          OrderItem: {
            createMany: {
              data: createOrderDto.items.map((orderItem) => ({
                productId: orderItem.productId,
                quantity: orderItem.quantity,
                price: products.find(({ id }) => id === orderItem.productId)
                  .price,
              })),
            },
          },
        },
        include: {
          OrderItem: {
            select: {
              price: true,
              quantity: true,
              productId: true,
            },
          },
        },
      });

      return {
        ...order,
        OrderItem: order.OrderItem.map((item) => ({
          ...item,
          name: products.find(({ id }) => id === item.productId).name,
        })),
      };
    } catch (error) {
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: 'Products not found',
      });
    }
  }

  async findAll(paginationDto: PaginationDto) {
    const { limit, page } = paginationDto;
    const where = { status: paginationDto.status };
    const total = await this.order.count({ where });
    const totalPages = Math.ceil(total / limit);
    const lastPage = Math.ceil(totalPages / limit);
    return {
      data: await this.order.findMany({
        take: limit,
        skip: (page - 1) * limit,
        where,
      }),
      meta: {
        total,
        page,
        totalPages,
        lastPage,
      },
    };
  }

  async findOne(id: string) {
    const order = await this.order
      .findUniqueOrThrow({
        where: { id },
        include: {
          OrderItem: {
            select: {
              price: true,
              quantity: true,
              productId: true,
            },
          },
        },
      })
      .catch(() => {
        throw new RpcException({
          message: `Order with id #${id} not found`,
          status: HttpStatus.NOT_FOUND,
        });
      });

    const productIds = order.OrderItem.map((item) => item.productId);
    const products = await this.getProductsByIds(productIds);

    return {
      ...order,
      OrderItem: order.OrderItem.map((item) => ({
        ...item,
        name: products.find(({ id }) => id === item.productId).name,
      })),
    };
  }

  async changeStatus(payload: ChangeOrderStatusDto) {
    const { id, status } = payload;
    const order = await this.findOne(id);

    if (order.status === status) {
      return order;
    }

    order.status = status;

    return this.order.update({
      where: { id },
      data: { status },
    });
  }

  async getProductsByIds(ids: number[]) {
    return await firstValueFrom(
      this.client.send({ cmd: 'validate_products' }, ids),
    );
  }
}
