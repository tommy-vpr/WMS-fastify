/**
 * Order Allocation Service
 * Handles inventory allocation for orders
 * Determines order status based on inventory availability
 */

import { prisma } from "@wms/db";

// ============================================================================
// Types
// ============================================================================

export interface OrderAllocationResult {
  orderId: string;
  orderNumber: string;
  status: "ALLOCATED" | "PARTIALLY_ALLOCATED" | "BACKORDERED" | "ON_HOLD";
  totalItems: number;
  allocatedItems: number;
  backorderedItems: number;
  unmatchedItems: number;
  allocations: OrderAllocationDetail[];
}

export interface OrderAllocationDetail {
  orderItemId: string;
  sku: string;
  quantityRequired: number;
  quantityAllocated: number;
  inventoryUnitId?: string;
  locationId?: string;
  status: "FULL" | "PARTIAL" | "NONE" | "UNMATCHED";
}

export interface AllocateOrdersRequest {
  orderIds: string[];
  allowPartial?: boolean;
}

export interface AllocateOrdersResult {
  fullyAllocated: OrderAllocationResult[];
  partiallyAllocated: OrderAllocationResult[];
  backordered: OrderAllocationResult[];
  onHold: OrderAllocationResult[];
  errors: { orderId: string; error: string }[];
}

// ============================================================================
// Main Service
// ============================================================================

export class OrderAllocationService {
  /**
   * Allocate inventory for multiple orders
   */
  async allocateOrders(
    request: AllocateOrdersRequest,
  ): Promise<AllocateOrdersResult> {
    const { orderIds, allowPartial = true } = request;

    const result: AllocateOrdersResult = {
      fullyAllocated: [],
      partiallyAllocated: [],
      backordered: [],
      onHold: [],
      errors: [],
    };

    for (const orderId of orderIds) {
      try {
        const allocationResult = await this.allocateOrder(
          orderId,
          allowPartial,
        );

        switch (allocationResult.status) {
          case "ALLOCATED":
            result.fullyAllocated.push(allocationResult);
            break;
          case "PARTIALLY_ALLOCATED":
            result.partiallyAllocated.push(allocationResult);
            break;
          case "BACKORDERED":
            result.backordered.push(allocationResult);
            break;
          case "ON_HOLD":
            result.onHold.push(allocationResult);
            break;
        }
      } catch (error) {
        result.errors.push({
          orderId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return result;
  }

  /**
   * Allocate inventory for a single order
   */
  async allocateOrder(
    orderId: string,
    allowPartial: boolean = true,
  ): Promise<OrderAllocationResult> {
    return await prisma.$transaction(async (tx) => {
      // 1. Get order with items
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
        },
      });

      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      // 2. Check if order can be allocated
      if (
        ![
          "PENDING",
          "CONFIRMED",
          "BACKORDERED",
          "PARTIALLY_ALLOCATED",
        ].includes(order.status)
      ) {
        throw new Error(
          `Order ${order.orderNumber} cannot be allocated (status: ${order.status})`,
        );
      }

      // 3. Check for unmatched items first
      const unmatchedItems = order.items.filter((item) => !item.matched);
      if (
        unmatchedItems.length > 0 &&
        unmatchedItems.length === order.items.length
      ) {
        // All items unmatched - put on hold
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: "ON_HOLD",
            holdReason: `All ${unmatchedItems.length} item(s) could not be matched to products`,
            holdAt: new Date(),
          },
        });

        return {
          orderId,
          orderNumber: order.orderNumber,
          status: "ON_HOLD",
          totalItems: order.items.length,
          allocatedItems: 0,
          backorderedItems: 0,
          unmatchedItems: unmatchedItems.length,
          allocations: order.items.map((item) => ({
            orderItemId: item.id,
            sku: item.sku,
            quantityRequired: item.quantity,
            quantityAllocated: 0,
            status: "UNMATCHED" as const,
          })),
        };
      }

      // 4. Allocate each matched item
      const allocations: OrderAllocationDetail[] = [];
      let totalAllocated = 0;
      let totalBackordered = 0;

      for (const item of order.items) {
        // Skip unmatched items
        if (!item.matched || !item.productVariantId) {
          allocations.push({
            orderItemId: item.id,
            sku: item.sku,
            quantityRequired: item.quantity,
            quantityAllocated: 0,
            status: "UNMATCHED",
          });
          continue;
        }

        const requiredQty = item.quantity - item.quantityAllocated;
        if (requiredQty <= 0) {
          // Already fully allocated
          allocations.push({
            orderItemId: item.id,
            sku: item.sku,
            quantityRequired: item.quantity,
            quantityAllocated: item.quantityAllocated,
            status: "FULL",
          });
          totalAllocated += item.quantityAllocated;
          continue;
        }

        // Find available inventory (FIFO/FEFO - oldest/expiring first)
        const availableInventory = await tx.inventoryUnit.findMany({
          where: {
            productVariantId: item.productVariantId,
            status: "AVAILABLE",
            quantity: { gt: 0 },
          },
          orderBy: [
            { expiryDate: "asc" }, // FEFO - expiring first
            { receivedAt: "asc" }, // FIFO - received first
          ],
          include: {
            location: true,
          },
        });

        let remainingToAllocate = requiredQty;
        let allocatedForItem = 0;

        for (const inv of availableInventory) {
          if (remainingToAllocate <= 0) break;
          if (!inv.location?.isPickable) continue;

          const allocateQty = Math.min(inv.quantity, remainingToAllocate);

          // Create allocation record
          await tx.allocation.create({
            data: {
              inventoryUnitId: inv.id,
              orderId: order.id,
              orderItemId: item.id,
              productVariantId: item.productVariantId,
              locationId: inv.locationId,
              quantity: allocateQty,
              lotNumber: inv.lotNumber,
              status: "ALLOCATED",
            },
          });

          // Update inventory status
          await tx.inventoryUnit.update({
            where: { id: inv.id },
            data: {
              quantity: { decrement: allocateQty },
              status:
                inv.quantity - allocateQty === 0 ? "RESERVED" : "AVAILABLE",
            },
          });

          remainingToAllocate -= allocateQty;
          allocatedForItem += allocateQty;

          // Track allocation detail
          allocations.push({
            orderItemId: item.id,
            sku: item.sku,
            quantityRequired: item.quantity,
            quantityAllocated: allocateQty,
            inventoryUnitId: inv.id,
            locationId: inv.locationId,
            status: allocateQty === requiredQty ? "FULL" : "PARTIAL",
          });
        }

        // Update order item allocated quantity
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            quantityAllocated: { increment: allocatedForItem },
          },
        });

        totalAllocated += allocatedForItem;

        if (remainingToAllocate > 0) {
          totalBackordered += remainingToAllocate;
          console.log(
            `[Allocation] Insufficient inventory for ${item.sku}: need ${requiredQty}, allocated ${allocatedForItem}`,
          );
        }
      }

      // 5. Determine final order status
      const matchedItems = order.items.filter((i) => i.matched);
      const totalRequired = matchedItems.reduce(
        (sum, i) => sum + i.quantity,
        0,
      );

      let newStatus:
        | "ALLOCATED"
        | "PARTIALLY_ALLOCATED"
        | "BACKORDERED"
        | "ON_HOLD";

      if (unmatchedItems.length > 0) {
        // Has some unmatched items
        if (totalAllocated === 0) {
          newStatus = "ON_HOLD";
        } else if (totalAllocated < totalRequired) {
          newStatus = "PARTIALLY_ALLOCATED";
        } else {
          newStatus = "PARTIALLY_ALLOCATED"; // Fully allocated matched items, but has unmatched
        }
      } else if (totalAllocated === 0) {
        newStatus = "BACKORDERED";
      } else if (totalAllocated < totalRequired) {
        newStatus = allowPartial ? "PARTIALLY_ALLOCATED" : "BACKORDERED";
      } else {
        newStatus = "ALLOCATED";
      }

      // 6. Update order status
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          ...(newStatus === "ON_HOLD" && {
            holdReason: `${unmatchedItems.length} unmatched item(s), ${totalBackordered} backordered`,
            holdAt: new Date(),
          }),
        },
      });

      console.log(
        `[Allocation] Order ${order.orderNumber}: ${newStatus} (${totalAllocated}/${totalRequired} allocated, ${totalBackordered} backordered, ${unmatchedItems.length} unmatched)`,
      );

      return {
        orderId,
        orderNumber: order.orderNumber,
        status: newStatus,
        totalItems: order.items.length,
        allocatedItems: totalAllocated,
        backorderedItems: totalBackordered,
        unmatchedItems: unmatchedItems.length,
        allocations,
      };
    });
  }

  /**
   * Release allocations for an order (e.g., on cancellation)
   */
  async releaseAllocations(orderId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const allocations = await tx.allocation.findMany({
        where: {
          orderId,
          status: { in: ["PENDING", "ALLOCATED"] },
        },
      });

      for (const alloc of allocations) {
        // Return inventory
        await tx.inventoryUnit.update({
          where: { id: alloc.inventoryUnitId },
          data: {
            quantity: { increment: alloc.quantity },
            status: "AVAILABLE",
          },
        });

        // Update allocation status
        await tx.allocation.update({
          where: { id: alloc.id },
          data: {
            status: "RELEASED",
            releasedAt: new Date(),
          },
        });

        // Update order item
        if (alloc.orderItemId) {
          await tx.orderItem.update({
            where: { id: alloc.orderItemId },
            data: {
              quantityAllocated: { decrement: alloc.quantity },
            },
          });
        }
      }

      console.log(
        `[Allocation] Released ${allocations.length} allocations for order ${orderId}`,
      );
    });
  }

  /**
   * Check for backordered orders when inventory is received
   */
  async checkBackorderedOrders(productVariantId: string): Promise<string[]> {
    // Find orders waiting for this product
    const waitingItems = await prisma.orderItem.findMany({
      where: {
        productVariantId,
        matched: true,
        order: {
          status: { in: ["BACKORDERED", "PARTIALLY_ALLOCATED"] },
        },
      },
      include: {
        order: true,
      },
    });

    const orderIds = [...new Set(waitingItems.map((i) => i.orderId))];

    if (orderIds.length > 0) {
      console.log(
        `[Allocation] Found ${orderIds.length} orders waiting for product ${productVariantId}`,
      );
    }

    return orderIds;
  }
}

// Singleton export
export const orderAllocationService = new OrderAllocationService();
