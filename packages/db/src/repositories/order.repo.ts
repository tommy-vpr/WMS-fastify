/**
 * Order Repository
 * Persistence layer for orders
 */

import { prisma } from "../client.js";
import type {
  OrderStatus,
  PaymentStatus,
  Priority,
  Prisma,
} from "../../prisma/generated/client/index.js";

export type { OrderStatus, PaymentStatus, Priority };

export interface Order {
  id: string;
  orderNumber: string;
  shopifyOrderId: string | null;
  customerId: string | null;
  customerName: string;
  customerEmail: string | null;
  shippingAddress: Prisma.JsonValue;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  priority: Priority;
  holdReason: string | null;
  holdAt: Date | null;
  holdBy: string | null;
  totalAmount: Prisma.Decimal;
  warehouseId: string | null;
  trackingNumber: string | null;
  shippedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productVariantId: string;
  sku: string;
  quantity: number;
  quantityAllocated: number;
  quantityPicked: number;
  unitPrice: Prisma.Decimal;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export const orderRepository = {
  async findById(id: string): Promise<Order | null> {
    return prisma.order.findUnique({
      where: { id },
    });
  },

  async findByIdWithItems(id: string): Promise<OrderWithItems | null> {
    return prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
  },

  async findByOrderNumber(orderNumber: string): Promise<OrderWithItems | null> {
    return prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true },
    });
  },

  async findByIds(ids: string[]): Promise<OrderWithItems[]> {
    return prisma.order.findMany({
      where: { id: { in: ids } },
      include: { items: true },
    });
  },

  async findByStatus(status: OrderStatus): Promise<Order[]> {
    return prisma.order.findMany({
      where: { status },
      orderBy: { createdAt: "asc" },
    });
  },

  async findByCustomer(customerId: string): Promise<Order[]> {
    return prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    });
  },

  async findReadyToPick(): Promise<OrderWithItems[]> {
    return prisma.order.findMany({
      where: {
        status: "READY_TO_PICK",
        paymentStatus: "PAID",
        holdReason: null,
      },
      include: { items: true },
      orderBy: [
        { priority: "desc" }, // EXPRESS > RUSH > STANDARD
        { createdAt: "asc" },
      ],
    });
  },

  async findEligibleForAllocation(): Promise<OrderWithItems[]> {
    return prisma.order.findMany({
      where: {
        status: "CONFIRMED",
        paymentStatus: { in: ["PAID", "AUTHORIZED"] },
        holdReason: null,
      },
      include: { items: true },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
  },

  async updateStatus(id: string, status: OrderStatus): Promise<void> {
    await prisma.order.update({
      where: { id },
      data: { status },
    });
  },

  async setHold(id: string, reason: string, userId?: string): Promise<void> {
    await prisma.order.update({
      where: { id },
      data: {
        status: "ON_HOLD",
        holdReason: reason,
        holdAt: new Date(),
        holdBy: userId,
      },
    });
  },

  async releaseHold(id: string, targetStatus: OrderStatus): Promise<void> {
    await prisma.order.update({
      where: { id },
      data: {
        status: targetStatus,
        holdReason: null,
        holdAt: null,
        holdBy: null,
      },
    });
  },

  async updateItemQuantities(
    orderItemId: string,
    data: { quantityAllocated?: number; quantityPicked?: number },
  ): Promise<void> {
    await prisma.orderItem.update({
      where: { id: orderItemId },
      data,
    });
  },

  async incrementItemAllocated(
    orderItemId: string,
    quantity: number,
  ): Promise<void> {
    await prisma.orderItem.update({
      where: { id: orderItemId },
      data: {
        quantityAllocated: { increment: quantity },
      },
    });
  },

  async incrementItemPicked(
    orderItemId: string,
    quantity: number,
  ): Promise<void> {
    await prisma.orderItem.update({
      where: { id: orderItemId },
      data: {
        quantityPicked: { increment: quantity },
      },
    });
  },

  async setShipped(id: string, trackingNumber: string): Promise<void> {
    await prisma.order.update({
      where: { id },
      data: {
        status: "SHIPPED",
        trackingNumber,
        shippedAt: new Date(),
      },
    });
  },

  async create(data: {
    orderNumber: string;
    shopifyOrderId?: string;
    customerId?: string;
    customerName: string;
    customerEmail?: string;
    shippingAddress: Prisma.InputJsonValue;
    totalAmount: number;
    priority?: Priority;
    items: Array<{
      productVariantId: string;
      sku: string;
      quantity: number;
      unitPrice: number;
    }>;
  }): Promise<OrderWithItems> {
    return prisma.order.create({
      data: {
        orderNumber: data.orderNumber,
        shopifyOrderId: data.shopifyOrderId,
        customerId: data.customerId,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        shippingAddress: data.shippingAddress,
        totalAmount: data.totalAmount,
        priority: data.priority ?? "STANDARD",
        status: "PENDING",
        paymentStatus: "PENDING",
        items: {
          create: data.items,
        },
      },
      include: { items: true },
    });
  },

  async getOrderStats(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    total: number;
    byStatus: Record<OrderStatus, number>;
  }> {
    const orders = await prisma.order.groupBy({
      by: ["status"],
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: true,
    });

    const byStatus = orders.reduce(
      (acc, o) => {
        acc[o.status] = o._count;
        return acc;
      },
      {} as Record<OrderStatus, number>,
    );

    const total = orders.reduce((sum, o) => sum + o._count, 0);

    return { total, byStatus };
  },
};
