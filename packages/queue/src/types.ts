/**
 * Queue Job Types
 * Type definitions for all queue jobs
 */

// ============================================================================
// Queue Names
// ============================================================================

export const QUEUES = {
  WORK_TASKS: "work-tasks",
  SHOPIFY: "shopify",
  ORDERS: "orders",
  PRODUCTS: "products",
  INVENTORY_PLANNER: "inventory-planner",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

// ============================================================================
// Work Task Jobs
// ============================================================================

export const WORK_TASK_JOBS = {
  CREATE_PICKING_TASK: "create-picking-task",
  ASSIGN_TASK: "assign-task",
  START_TASK: "start-task",
  COMPLETE_TASK: "complete-task",
  CANCEL_TASK: "cancel-task",
} as const;

export type WorkTaskJobName =
  (typeof WORK_TASK_JOBS)[keyof typeof WORK_TASK_JOBS];

// ============================================================================
// Job Data Types
// ============================================================================

export interface CreatePickingTaskJobData {
  orderIds: string[];
  idempotencyKey: string;
  priority?: number;
  notes?: string;
}

export interface AssignTaskJobData {
  taskId: string;
  userId: string;
}

export interface StartTaskJobData {
  taskId: string;
  userId: string;
}

export interface CompleteTaskJobData {
  taskId: string;
  userId: string;
}

export interface CancelTaskJobData {
  taskId: string;
  reason: string;
  userId?: string;
}

// Union of all job data types
export type WorkTaskJobData =
  | CreatePickingTaskJobData
  | AssignTaskJobData
  | StartTaskJobData
  | CompleteTaskJobData
  | CancelTaskJobData;

// ============================================================================
// Job Results
// ============================================================================

export interface CreatePickingTaskResult {
  taskId: string;
  taskNumber: string;
  itemCount: number;
}

export interface AssignTaskResult {
  taskId: string;
  userId: string;
  assigned: boolean;
}

export interface StartTaskResult {
  taskId: string;
  started: boolean;
}

export interface CompleteTaskResult {
  taskId: string;
  completed: boolean;
}

export interface CancelTaskResult {
  taskId: string;
  cancelled: boolean;
}

// ============================================================================
// Shopify Jobs
// ============================================================================

export const SHOPIFY_JOBS = {
  ORDER_CREATE: "shopify-order-create",
  ORDER_UPDATE: "shopify-order-update",
  ORDER_CANCEL: "shopify-order-cancel",
  FULFILLMENT_CREATE: "shopify-fulfillment-create",
} as const;

export type ShopifyJobName = (typeof SHOPIFY_JOBS)[keyof typeof SHOPIFY_JOBS];

export interface ShopifyOrderCreateJobData {
  shopifyOrderId: string;
  payload: Record<string, unknown>;
  receivedAt: string;
  idempotencyKey: string;
}

export interface ShopifyOrderUpdateJobData {
  shopifyOrderId: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}

export interface ShopifyOrderCancelJobData {
  shopifyOrderId: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}

export type ShopifyJobData =
  | ShopifyOrderCreateJobData
  | ShopifyOrderUpdateJobData
  | ShopifyOrderCancelJobData;

// ============================================================================
// Order Allocation Jobs
// ============================================================================

export const ORDER_JOBS = {
  ALLOCATE_ORDER: "allocate-order",
  ALLOCATE_ORDERS: "allocate-orders",
  RELEASE_ALLOCATIONS: "release-allocations",
  CHECK_BACKORDERS: "check-backorders",
} as const;

export type OrderJobName = (typeof ORDER_JOBS)[keyof typeof ORDER_JOBS];

export interface AllocateOrderJobData {
  orderId: string;
  allowPartial?: boolean;
  idempotencyKey?: string;
}

export interface AllocateOrdersJobData {
  orderIds: string[];
  allowPartial?: boolean;
  idempotencyKey?: string;
}

export interface ReleaseAllocationsJobData {
  orderId: string;
  reason?: string;
}

export interface CheckBackordersJobData {
  productVariantId: string;
  triggerSource?: string; // e.g., "receiving", "adjustment"
}

// ============================================================================
// Product Jobs
// ============================================================================

export const PRODUCT_JOBS = {
  IMPORT_PRODUCTS: "import-products",
  IMPORT_SINGLE: "import-single",
  SYNC_SHOPIFY_PRODUCTS: "sync-shopify-products",
} as const;

export type ProductJobName = (typeof PRODUCT_JOBS)[keyof typeof PRODUCT_JOBS];

export interface ProductImportItem {
  product: {
    sku: string;
    name: string;
    description?: string;
    brand?: string;
    category?: string;
  };
  variants: Array<{
    sku: string;
    upc?: string;
    barcode?: string;
    name: string;
    weight?: number;
    costPrice?: number;
    sellingPrice?: number;
    shopifyVariantId?: string;
  }>;
}

export interface ImportProductsJobData {
  products: ProductImportItem[];
  userId?: string;
  idempotencyKey: string;
}

export interface ImportSingleProductJobData {
  product: ProductImportItem["product"];
  variants: ProductImportItem["variants"];
  userId?: string;
}

export interface SyncShopifyProductsJobData {
  cursor?: string;
  limit?: number;
  idempotencyKey: string;
}

export interface ImportProductsResult {
  success: number;
  failed: number;
  errors: Array<{ sku: string; error: string }>;
}

// ============================================================================
// Inventory Planner
// ============================================================================

export const INVENTORY_PLANNER_JOBS = {
  SYNC_INVENTORY: "sync-inventory-planner",
} as const;

export interface SyncInventoryPlannerJobData {
  userId?: string;
  idempotencyKey: string;
}

export interface SyncInventoryPlannerResult {
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  errors: string[];
  totalIPVariants: number;
  totalWMSVariants: number;
}
