/**
 * Allocation Service
 * Manages inventory allocation for orders
 */

import {
  type AllocationPolicy,
  type AllocationRequest,
  type Allocation,
  type AvailableInventory,
  createAllocationPolicy,
  type PolicyType,
  InsufficientInventoryError,
} from "../policies/allocation.policy.js";
import { type InventoryRepository } from "./inventory.service.js";

export type AllocationStatus = "PENDING" | "ALLOCATED" | "RELEASED" | "PICKED";

export interface AllocationRecord {
  id: string;
  orderId: string;
  inventoryUnitId: string;
  sku: string;
  quantity: number;
  locationId: string;
  lotNumber?: string;
  status: AllocationStatus;
  allocatedAt: Date;
  releasedAt?: Date;
  pickedAt?: Date;
}

export interface AllocationRepository {
  create(
    allocation: Omit<AllocationRecord, "id" | "allocatedAt">,
  ): Promise<AllocationRecord>;
  createMany(
    allocations: Omit<AllocationRecord, "id" | "allocatedAt">[],
  ): Promise<AllocationRecord[]>;
  findByOrderId(orderId: string): Promise<AllocationRecord[]>;
  findByInventoryUnitId(inventoryUnitId: string): Promise<AllocationRecord[]>;
  updateStatus(id: string, status: AllocationStatus): Promise<void>;
  releaseByOrderId(orderId: string): Promise<void>;
}

export interface AllocationServiceDeps {
  allocationRepo: AllocationRepository;
  inventoryRepo: InventoryRepository;
  defaultPolicy?: PolicyType;
}

export interface AllocateOrderRequest {
  orderId: string;
  warehouseId: string;
  items: Array<{
    sku: string;
    quantity: number;
  }>;
  policy?: PolicyType;
}

export interface AllocationResult {
  success: boolean;
  orderId: string;
  allocations: AllocationRecord[];
  errors: AllocationError[];
}

export interface AllocationError {
  sku: string;
  requested: number;
  available: number;
  message: string;
}

export class AllocationService {
  private allocationRepo: AllocationRepository;
  private inventoryRepo: InventoryRepository;
  private defaultPolicy: PolicyType;

  constructor(deps: AllocationServiceDeps) {
    this.allocationRepo = deps.allocationRepo;
    this.inventoryRepo = deps.inventoryRepo;
    this.defaultPolicy = deps.defaultPolicy ?? "FIFO";
  }

  /**
   * Allocate inventory for an entire order
   * Uses transaction to ensure all-or-nothing allocation
   */
  async allocateOrder(
    request: AllocateOrderRequest,
  ): Promise<AllocationResult> {
    const policy = createAllocationPolicy(request.policy ?? this.defaultPolicy);
    const allocations: Allocation[] = [];
    const errors: AllocationError[] = [];

    // First pass: calculate all allocations
    for (const item of request.items) {
      try {
        const available = await this.inventoryRepo.findAvailableBySku(
          item.sku,
          request.warehouseId,
        );

        const allocationRequest: AllocationRequest = {
          orderId: request.orderId,
          sku: item.sku,
          quantity: item.quantity,
          warehouseId: request.warehouseId,
        };

        const itemAllocations = policy.allocate(
          allocationRequest,
          available as AvailableInventory[],
        );
        allocations.push(...itemAllocations);
      } catch (error) {
        if (error instanceof InsufficientInventoryError) {
          errors.push({
            sku: item.sku,
            requested: error.requested,
            available: error.available,
            message: error.message,
          });
        } else {
          throw error;
        }
      }
    }

    // If any errors, fail the entire allocation
    if (errors.length > 0) {
      return {
        success: false,
        orderId: request.orderId,
        allocations: [],
        errors,
      };
    }

    // Second pass: persist allocations and update inventory status
    // This should be wrapped in a transaction at the repository level
    const records = await this.allocationRepo.createMany(
      allocations.map((a) => ({
        orderId: a.orderId,
        inventoryUnitId: a.inventoryUnitId,
        sku: a.sku,
        quantity: a.quantity,
        locationId: a.locationId,
        lotNumber: a.lotNumber,
        status: "ALLOCATED" as AllocationStatus,
      })),
    );

    // Update inventory status to RESERVED
    for (const allocation of allocations) {
      await this.inventoryRepo.updateStatus(
        allocation.inventoryUnitId,
        "RESERVED",
      );
    }

    return {
      success: true,
      orderId: request.orderId,
      allocations: records,
      errors: [],
    };
  }

  /**
   * Release all allocations for an order
   */
  async releaseOrder(orderId: string): Promise<void> {
    const allocations = await this.allocationRepo.findByOrderId(orderId);

    for (const allocation of allocations) {
      if (allocation.status === "ALLOCATED") {
        // Release inventory back to available
        await this.inventoryRepo.updateStatus(
          allocation.inventoryUnitId,
          "AVAILABLE",
        );
      }
    }

    await this.allocationRepo.releaseByOrderId(orderId);
  }

  /**
   * Mark allocation as picked
   */
  async markPicked(allocationId: string): Promise<void> {
    await this.allocationRepo.updateStatus(allocationId, "PICKED");
  }

  /**
   * Get allocations for an order
   */
  async getOrderAllocations(orderId: string): Promise<AllocationRecord[]> {
    return this.allocationRepo.findByOrderId(orderId);
  }

  /**
   * Check if an order is fully allocated
   */
  async isOrderAllocated(orderId: string): Promise<boolean> {
    const allocations = await this.allocationRepo.findByOrderId(orderId);
    return (
      allocations.length > 0 &&
      allocations.every((a) => a.status === "ALLOCATED")
    );
  }
}
