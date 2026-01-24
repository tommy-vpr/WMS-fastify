/**
 * Domain Events
 * Events that can be published when domain state changes
 */

export type DomainEvent =
  | PicklistCreatedEvent
  | PicklistAssignedEvent
  | PicklistStartedEvent
  | PicklistCompletedEvent
  | PicklistCancelledEvent
  | PicklistBlockedEvent
  | InventoryAllocatedEvent
  | InventoryReleasedEvent
  | InventoryPickedEvent
  | OrderStatusChangedEvent
  | PickStepCompletedEvent;

// Base event interface
interface BaseEvent {
  id: string;
  timestamp: Date;
  correlationId?: string;
}

// Picklist events
export interface PicklistCreatedEvent extends BaseEvent {
  type: "PICKLIST_CREATED";
  payload: {
    picklistId: string;
    orderIds: string[];
    warehouseId: string;
    itemCount: number;
  };
}

export interface PicklistAssignedEvent extends BaseEvent {
  type: "PICKLIST_ASSIGNED";
  payload: {
    picklistId: string;
    pickerId: string;
    assignedAt: Date;
  };
}

export interface PicklistStartedEvent extends BaseEvent {
  type: "PICKLIST_STARTED";
  payload: {
    picklistId: string;
    pickerId: string;
    startedAt: Date;
  };
}

export interface PicklistCompletedEvent extends BaseEvent {
  type: "PICKLIST_COMPLETED";
  payload: {
    picklistId: string;
    pickerId: string;
    completedAt: Date;
    itemsPicked: number;
    duration: number; // seconds
  };
}

export interface PicklistCancelledEvent extends BaseEvent {
  type: "PICKLIST_CANCELLED";
  payload: {
    picklistId: string;
    reason: string;
    cancelledBy: string;
  };
}

export interface PicklistBlockedEvent extends BaseEvent {
  type: "PICKLIST_BLOCKED";
  payload: {
    picklistId: string;
    blockReason: string;
    pickStepId?: string;
  };
}

// Inventory events
export interface InventoryAllocatedEvent extends BaseEvent {
  type: "INVENTORY_ALLOCATED";
  payload: {
    allocationId: string;
    orderId: string;
    sku: string;
    quantity: number;
    locationId: string;
    lotNumber?: string;
  };
}

export interface InventoryReleasedEvent extends BaseEvent {
  type: "INVENTORY_RELEASED";
  payload: {
    allocationId: string;
    orderId: string;
    sku: string;
    quantity: number;
    reason: "CANCELLED" | "SHORT_PICK" | "REALLOCATION";
  };
}

export interface InventoryPickedEvent extends BaseEvent {
  type: "INVENTORY_PICKED";
  payload: {
    inventoryUnitId: string;
    picklistId: string;
    pickStepId: string;
    sku: string;
    quantity: number;
    locationId: string;
  };
}

// Order events
export interface OrderStatusChangedEvent extends BaseEvent {
  type: "ORDER_STATUS_CHANGED";
  payload: {
    orderId: string;
    previousStatus: string;
    newStatus: string;
    changedBy?: string;
  };
}

// Pick step events
export interface PickStepCompletedEvent extends BaseEvent {
  type: "PICK_STEP_COMPLETED";
  payload: {
    pickStepId: string;
    picklistId: string;
    sku: string;
    expectedQty: number;
    actualQty: number;
    locationId: string;
    pickerId: string;
  };
}

// Event factory helpers
export function createEvent<T extends DomainEvent>(
  type: T["type"],
  payload: T["payload"],
  correlationId?: string,
): T {
  return {
    id: crypto.randomUUID(),
    type,
    timestamp: new Date(),
    correlationId,
    payload,
  } as T;
}

// Event bus interface (implement with your preferred transport)
export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe<T extends DomainEvent>(
    eventType: T["type"],
    handler: (event: T) => Promise<void>,
  ): void;
}
