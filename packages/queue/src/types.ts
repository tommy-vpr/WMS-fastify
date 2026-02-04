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
  FULFILLMENT: "fulfillment",
  SHIPPING: "shipping",
  RECEIVING: "receiving",
  CYCLE_COUNT: "cycle-count",
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

export const RECEIVING_JOBS = {
  SYNC_PURCHASE_ORDERS: "sync_purchase_orders",
  PROCESS_APPROVAL: "process_approval",
  NOTIFY_APPROVERS: "notify_approvers",
  AUTO_APPROVE_SESSION: "auto_approve_session",
  GENERATE_BARCODE_LABELS: "generate_barcode_labels",
} as const;

export const SHIPPING_JOBS = {
  CREATE_LABEL: "create-label",
  SYNC_SHOPIFY_FULFILLMENT: "sync-shopify-fulfillment",
  VOID_LABEL: "void-label",
  UPDATE_TRACKING: "update-tracking",
  BATCH_CREATE_LABELS: "batch-create-labels",
} as const;

export interface CreateLabelJobData {
  orderId: string;
  carrierCode: string;
  serviceCode: string;
  packages: Array<{
    packageCode: string;
    weight: number;
    length?: number;
    width?: number;
    height?: number;
    items?: Array<{
      sku: string;
      quantity: number;
      productName?: string;
      unitPrice?: number;
    }>;
  }>;
  shippingAddress?: {
    name: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    country?: string;
    phone?: string;
  };
  items?: Array<{
    sku: string;
    quantity: number;
    productName?: string;
    unitPrice?: number;
  }>;
  notes?: string;
  userId: string;
}

export interface SyncShopifyFulfillmentJobData {
  orderId: string;
  shopifyOrderId: string;
  trackingNumbers: string[];
  carrier: string;
  items?: Array<{
    sku: string;
    quantity: number;
  }>;
}

export interface VoidLabelJobData {
  labelId: string;
  packageId?: string;
  orderId?: string;
  userId?: string;
}

export type WorkTaskJobName =
  (typeof WORK_TASK_JOBS)[keyof typeof WORK_TASK_JOBS];

// ============================================================================
// Job Data Types
// ============================================================================

export interface SyncPurchaseOrdersJobData {
  source: "inventory_planner" | "manual";
  accountId?: string;
  idempotencyKey?: string;
}

export interface ProcessApprovalJobData {
  sessionId: string;
  approverId: string;
  idempotencyKey?: string;
}

export interface NotifyApproversJobData {
  sessionId: string;
  poReference: string;
  submittedBy: string;
  totalItems: number;
  totalCounted: number;
  assignedTo?: string;
}

export interface AutoApproveSessionJobData {
  sessionId: string;
  maxVariancePercent: number;
  idempotencyKey?: string;
}

export interface GenerateBarcodeLabelsJobData {
  sessionId: string;
  items: Array<{
    sku: string;
    barcode: string;
    productName: string;
    quantity: number;
  }>;
  printerId?: string;
}

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

export const FULFILLMENT_JOBS = {
  CREATE_SHIPPING_LABEL: "create-shipping-label",
  SHOPIFY_FULFILL: "shopify-fulfill",
} as const;

export type FulfillmentJobName =
  (typeof FULFILLMENT_JOBS)[keyof typeof FULFILLMENT_JOBS];

/** Background job: create shipping label via ShipEngine */
export interface CreateShippingLabelJobData {
  orderId: string;
  userId?: string;
  carrier: string;
  service: string;
  weight?: number;
  weightUnit?: string;
  dimensions?: { length: number; width: number; height: number; unit: string };
  idempotencyKey: string;
}

// ============================================================================
// Shopify Jobs
// ============================================================================

/** Background job: mark order fulfilled in Shopify after shipping */
export interface ShopifyFulfillJobData {
  orderId: string;
  trackingNumber: string;
  carrier: string;
  idempotencyKey: string;
}

export interface CreateShippingLabelResult {
  orderId: string;
  trackingNumber: string;
  labelUrl: string;
  carrier: string;
  service: string;
}

export interface ShopifyFulfillResult {
  orderId: string;
  shopifyOrderId: string;
  fulfilled: boolean;
}

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

// ============================================================================
// Cycle Count
// ============================================================================

export const CYCLE_COUNT_JOBS = {
  PROCESS_APPROVAL: "cycle-count:process-approval",
  GENERATE_TASKS: "cycle-count:generate-tasks",
  NOTIFY_REVIEWERS: "cycle-count:notify-reviewers",
  GENERATE_VARIANCE_REPORT: "cycle-count:generate-variance-report",
} as const;

export interface ProcessCycleCountApprovalJobData {
  sessionId: string;
  approvedById: string;
  idempotencyKey?: string;
}

export interface GenerateCycleCountTasksJobData {
  type: "ABC" | "ZONE" | "DAYS_SINCE_COUNT";
  criteria: {
    abcClass?: string;
    zoneId?: string;
    daysSinceCount?: number;
    maxLocations?: number;
  };
  assignToId?: string;
  createdById: string;
  idempotencyKey?: string;
}

export interface NotifyCycleCountReviewersJobData {
  sessionId: string;
  locationName: string;
  countedByName: string;
  varianceCount: number;
  idempotencyKey?: string;
}

export interface GenerateVarianceReportJobData {
  sessionId: string;
  format: "PDF" | "CSV";
  emailTo?: string;
  idempotencyKey?: string;
}
