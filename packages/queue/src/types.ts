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
// Shopify Sync Jobs
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
  payload: Record<string, unknown>; // Raw Shopify webhook payload
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

// export interface WorkTaskJobData {
//   taskId: string;
//   type: string;
//   action: "process" | "assign" | "complete" | "cancel";
//   userId?: string;
//   metadata?: Record<string, unknown>;
// }

// export interface ShopifySyncJobData {
//   syncType: "orders" | "products" | "inventory" | "fulfillment";
//   orderId?: string;
//   productId?: string;
//   action: "sync" | "webhook";
//   payload?: Record<string, unknown>;
// }

// export interface JobResult {
//   success: boolean;
//   message?: string;
//   data?: Record<string, unknown>;
// }
