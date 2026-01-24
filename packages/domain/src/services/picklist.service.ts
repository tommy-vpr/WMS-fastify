/**
 * Picklist Service
 * Main orchestration service for picklist generation and management
 */

import {
  PicklistStatus,
  PicklistBlockReason,
  assertTransition,
  isTerminalState,
} from "../state-machines/picklist.states.js";
import { OrderStatus } from "../state-machines/order.states.js";
import {
  type AllocationService,
  type AllocationRecord,
} from "./allocation.service.js";
import { type OrderService } from "./order.service.js";
import {
  type EligibilityPolicy,
  createDefaultEligibilityPolicy,
  type Order,
} from "../policies/eligibility.policy.js";
import {
  createEvent,
  type PicklistCreatedEvent,
  type DomainEvent,
} from "../events/domain-events.js";

export interface Picklist {
  id: string;
  status: PicklistStatus;
  warehouseId: string;
  orderIds: string[];
  pickerId?: string;
  blockReason?: PicklistBlockReason;
  createdAt: Date;
  assignedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface PicklistItem {
  id: string;
  picklistId: string;
  sku: string;
  quantity: number;
  locationId: string;
  lotNumber?: string;
  allocationId: string;
  sequence: number; // Pick order
  pickedQuantity: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SHORT" | "SKIPPED";
}

export interface PicklistRepository {
  create(picklist: Omit<Picklist, "id" | "createdAt">): Promise<Picklist>;
  findById(id: string): Promise<Picklist | null>;
  findByOrderId(orderId: string): Promise<Picklist[]>;
  updateStatus(id: string, status: PicklistStatus): Promise<void>;
  assignPicker(id: string, pickerId: string): Promise<void>;
  setBlockReason(id: string, reason: PicklistBlockReason): Promise<void>;
  clearBlockReason(id: string): Promise<void>;
}

export interface PicklistItemRepository {
  createMany(items: Omit<PicklistItem, "id">[]): Promise<PicklistItem[]>;
  findByPicklistId(picklistId: string): Promise<PicklistItem[]>;
  updatePickedQuantity(id: string, quantity: number): Promise<void>;
  updateStatus(id: string, status: PicklistItem["status"]): Promise<void>;
}

export interface PicklistServiceDeps {
  picklistRepo: PicklistRepository;
  picklistItemRepo: PicklistItemRepository;
  allocationService: AllocationService;
  orderService: OrderService;
  eligibilityPolicy?: EligibilityPolicy;
  eventPublisher?: (event: DomainEvent) => Promise<void>;
}

export interface GeneratePicklistRequest {
  orderIds: string[];
  warehouseId: string;
  idempotencyKey: string;
}

export interface GeneratePicklistResult {
  success: boolean;
  picklist?: Picklist;
  items?: PicklistItem[];
  error?: string;
}

export class PicklistService {
  private picklistRepo: PicklistRepository;
  private picklistItemRepo: PicklistItemRepository;
  private allocationService: AllocationService;
  private orderService: OrderService;
  private eligibilityPolicy: EligibilityPolicy;
  private eventPublisher?: (event: DomainEvent) => Promise<void>;

  constructor(deps: PicklistServiceDeps) {
    this.picklistRepo = deps.picklistRepo;
    this.picklistItemRepo = deps.picklistItemRepo;
    this.allocationService = deps.allocationService;
    this.orderService = deps.orderService;
    this.eligibilityPolicy =
      deps.eligibilityPolicy ?? createDefaultEligibilityPolicy();
    this.eventPublisher = deps.eventPublisher;
  }

  /**
   * Generate a picklist for one or more orders
   * This is the main workflow that should be called from a worker job
   */
  async generate(
    request: GeneratePicklistRequest,
  ): Promise<GeneratePicklistResult> {
    // Step 1: Validate all orders are eligible
    for (const orderId of request.orderIds) {
      const eligibility = await this.orderService.checkEligibility(orderId);
      if (!eligibility.eligible) {
        return {
          success: false,
          error: `Order ${orderId} not eligible: ${eligibility.reasons.join(", ")}`,
        };
      }
    }

    // Step 2: Get orders and their items
    const orders = await this.orderService.getOrders(request.orderIds);
    if (orders.length !== request.orderIds.length) {
      const foundIds = orders.map((o) => o.id);
      const missing = request.orderIds.filter((id) => !foundIds.includes(id));
      return {
        success: false,
        error: `Orders not found: ${missing.join(", ")}`,
      };
    }

    // Step 3: Allocate inventory for each order
    const allAllocations: AllocationRecord[] = [];
    for (const order of orders) {
      const allocationResult = await this.allocationService.allocateOrder({
        orderId: order.id,
        warehouseId: request.warehouseId,
        items: order.items.map((item) => ({
          sku: item.sku,
          quantity: item.quantity,
        })),
      });

      if (!allocationResult.success) {
        // Rollback any allocations we've made
        for (const allocation of allAllocations) {
          await this.allocationService.releaseOrder(allocation.orderId);
        }
        return {
          success: false,
          error: `Allocation failed for order ${order.id}: ${allocationResult.errors.map((e) => e.message).join(", ")}`,
        };
      }

      allAllocations.push(...allocationResult.allocations);
    }

    // Step 4: Create the picklist
    const picklist = await this.picklistRepo.create({
      status: PicklistStatus.CREATED,
      warehouseId: request.warehouseId,
      orderIds: request.orderIds,
    });

    // Step 5: Create pick items with optimized sequence
    const pickItems = this.createPickItems(picklist.id, allAllocations);
    const items = await this.picklistItemRepo.createMany(pickItems);

    // Step 6: Transition orders to PICKING status
    for (const orderId of request.orderIds) {
      await this.orderService.markPicking(orderId);
    }

    // Step 7: Publish event
    if (this.eventPublisher) {
      const event = createEvent<PicklistCreatedEvent>("PICKLIST_CREATED", {
        picklistId: picklist.id,
        orderIds: request.orderIds,
        warehouseId: request.warehouseId,
        itemCount: items.length,
      });
      await this.eventPublisher(event);
    }

    return {
      success: true,
      picklist,
      items,
    };
  }

  /**
   * Assign a picker to a picklist
   */
  async assign(picklistId: string, pickerId: string): Promise<void> {
    const picklist = await this.picklistRepo.findById(picklistId);
    if (!picklist) {
      throw new PicklistNotFoundError(picklistId);
    }

    assertTransition(picklist.status, PicklistStatus.ASSIGNED);
    await this.picklistRepo.assignPicker(picklistId, pickerId);
    await this.picklistRepo.updateStatus(picklistId, PicklistStatus.ASSIGNED);
  }

  /**
   * Start picking
   */
  async start(picklistId: string): Promise<void> {
    const picklist = await this.picklistRepo.findById(picklistId);
    if (!picklist) {
      throw new PicklistNotFoundError(picklistId);
    }

    if (!picklist.pickerId) {
      throw new Error(`Picklist ${picklistId} has no assigned picker`);
    }

    assertTransition(picklist.status, PicklistStatus.IN_PROGRESS);
    await this.picklistRepo.updateStatus(
      picklistId,
      PicklistStatus.IN_PROGRESS,
    );
  }

  /**
   * Record a pick for a picklist item
   */
  async recordPick(
    picklistItemId: string,
    actualQuantity: number,
  ): Promise<{ complete: boolean; short: boolean }> {
    const items = await this.picklistItemRepo.findByPicklistId(picklistItemId);
    const item = items.find((i) => i.id === picklistItemId);

    if (!item) {
      throw new Error(`Picklist item ${picklistItemId} not found`);
    }

    await this.picklistItemRepo.updatePickedQuantity(
      picklistItemId,
      actualQuantity,
    );

    const short = actualQuantity < item.quantity;
    if (short) {
      await this.picklistItemRepo.updateStatus(picklistItemId, "SHORT");
    } else {
      await this.picklistItemRepo.updateStatus(picklistItemId, "COMPLETED");
    }

    // Mark allocation as picked
    await this.allocationService.markPicked(item.allocationId);

    return {
      complete: actualQuantity >= item.quantity,
      short,
    };
  }

  /**
   * Block a picklist
   */
  async block(picklistId: string, reason: PicklistBlockReason): Promise<void> {
    const picklist = await this.picklistRepo.findById(picklistId);
    if (!picklist) {
      throw new PicklistNotFoundError(picklistId);
    }

    assertTransition(picklist.status, PicklistStatus.BLOCKED);
    await this.picklistRepo.setBlockReason(picklistId, reason);
    await this.picklistRepo.updateStatus(picklistId, PicklistStatus.BLOCKED);
  }

  /**
   * Unblock and resume a picklist
   */
  async unblock(picklistId: string): Promise<void> {
    const picklist = await this.picklistRepo.findById(picklistId);
    if (!picklist) {
      throw new PicklistNotFoundError(picklistId);
    }

    if (picklist.status !== PicklistStatus.BLOCKED) {
      throw new Error(`Picklist ${picklistId} is not blocked`);
    }

    await this.picklistRepo.clearBlockReason(picklistId);
    await this.picklistRepo.updateStatus(
      picklistId,
      PicklistStatus.IN_PROGRESS,
    );
  }

  /**
   * Complete a picklist
   */
  async complete(picklistId: string): Promise<void> {
    const picklist = await this.picklistRepo.findById(picklistId);
    if (!picklist) {
      throw new PicklistNotFoundError(picklistId);
    }

    // Verify all items are picked or accounted for
    const items = await this.picklistItemRepo.findByPicklistId(picklistId);
    const incomplete = items.filter(
      (i) =>
        i.status !== "COMPLETED" &&
        i.status !== "SHORT" &&
        i.status !== "SKIPPED",
    );

    if (incomplete.length > 0) {
      throw new Error(
        `Cannot complete picklist - ${incomplete.length} items still pending`,
      );
    }

    assertTransition(picklist.status, PicklistStatus.COMPLETED);
    await this.picklistRepo.updateStatus(picklistId, PicklistStatus.COMPLETED);

    // Transition orders to PICKED
    for (const orderId of picklist.orderIds) {
      await this.orderService.markPicked(orderId);
    }
  }

  /**
   * Cancel a picklist
   */
  async cancel(picklistId: string, reason: string): Promise<void> {
    const picklist = await this.picklistRepo.findById(picklistId);
    if (!picklist) {
      throw new PicklistNotFoundError(picklistId);
    }

    if (isTerminalState(picklist.status)) {
      throw new Error(`Cannot cancel picklist in ${picklist.status} status`);
    }

    // Release all allocations
    for (const orderId of picklist.orderIds) {
      await this.allocationService.releaseOrder(orderId);
    }

    await this.picklistRepo.updateStatus(picklistId, PicklistStatus.CANCELLED);
  }

  /**
   * Create pick items from allocations with optimized pick sequence
   */
  private createPickItems(
    picklistId: string,
    allocations: AllocationRecord[],
  ): Omit<PicklistItem, "id">[] {
    // Sort by location for optimized pick path
    // In a real system, this would use zone/aisle/bin sorting
    const sorted = [...allocations].sort((a, b) =>
      a.locationId.localeCompare(b.locationId),
    );

    return sorted.map((allocation, index) => ({
      picklistId,
      sku: allocation.sku,
      quantity: allocation.quantity,
      locationId: allocation.locationId,
      lotNumber: allocation.lotNumber,
      allocationId: allocation.id,
      sequence: index + 1,
      pickedQuantity: 0,
      status: "PENDING" as const,
    }));
  }
}

export class PicklistNotFoundError extends Error {
  constructor(public readonly picklistId: string) {
    super(`Picklist not found: ${picklistId}`);
    this.name = "PicklistNotFoundError";
  }
}
