/**
 * Queue Instances & Helpers
 * Functions to enqueue jobs from the API
 */

import { Queue, type JobsOptions } from "bullmq";
import { getConnection } from "./connection.js";
import {
  QUEUES,
  WORK_TASK_JOBS,
  SHOPIFY_JOBS,
  ORDER_JOBS,
  PRODUCT_JOBS,
  type CreatePickingTaskJobData,
  type AssignTaskJobData,
  type StartTaskJobData,
  type CancelTaskJobData,
  type ShopifyOrderCreateJobData,
  type AllocateOrderJobData,
  type AllocateOrdersJobData,
  type ReleaseAllocationsJobData,
  type CheckBackordersJobData,
  type ImportProductsJobData,
  type ImportSingleProductJobData,
  type SyncShopifyProductsJobData,
  SyncInventoryPlannerJobData,
  INVENTORY_PLANNER_JOBS,
  FULFILLMENT_JOBS,
  CreateShippingLabelJobData,
  ShopifyFulfillJobData,
} from "./types.js";

// ============================================================================
// Queue Instances
// ============================================================================

let workTaskQueue: Queue | null = null;
let shopifyQueue: Queue | null = null;
let ordersQueue: Queue | null = null;
let productsQueue: Queue | null = null;
let inventoryPlannerQueue: Queue | null = null;
let fulfillmentQueue: Queue | null = null;

export function getWorkTaskQueue(): Queue {
  if (!workTaskQueue) {
    workTaskQueue = new Queue(QUEUES.WORK_TASKS, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: {
          count: 1000,
          age: 24 * 60 * 60,
        },
        removeOnFail: {
          count: 5000,
          age: 7 * 24 * 60 * 60,
        },
      },
    });
  }
  return workTaskQueue;
}

export function getFulfillmentQueue(): Queue {
  if (!fulfillmentQueue) {
    fulfillmentQueue = new Queue(QUEUES.FULFILLMENT, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { count: 1000, age: 24 * 60 * 60 },
        removeOnFail: { count: 5000, age: 7 * 24 * 60 * 60 },
      },
    });
  }
  return fulfillmentQueue;
}

export async function enqueueCreateShippingLabel(
  data: CreateShippingLabelJobData,
  options?: JobsOptions,
) {
  const queue = getFulfillmentQueue();
  return queue.add(FULFILLMENT_JOBS.CREATE_SHIPPING_LABEL, data, {
    ...options,
    jobId: data.idempotencyKey,
  });
}

/**
 * Enqueue Shopify fulfillment after an order is shipped
 * Sends tracking number to Shopify and marks order as fulfilled
 */
export async function enqueueShopifyFulfill(
  data: ShopifyFulfillJobData,
  options?: JobsOptions,
) {
  const queue = getFulfillmentQueue();
  return queue.add(FULFILLMENT_JOBS.SHOPIFY_FULFILL, data, {
    ...options,
    jobId: data.idempotencyKey,
  });
}

export function getShopifyQueue(): Queue {
  if (!shopifyQueue) {
    shopifyQueue = new Queue(QUEUES.SHOPIFY, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 5, // More retries for external webhooks
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: { count: 1000, age: 24 * 60 * 60 },
        removeOnFail: { count: 5000, age: 7 * 24 * 60 * 60 },
      },
    });
  }
  return shopifyQueue;
}

export function getOrdersQueue(): Queue {
  if (!ordersQueue) {
    ordersQueue = new Queue(QUEUES.ORDERS, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: { count: 1000, age: 24 * 60 * 60 },
        removeOnFail: { count: 5000, age: 7 * 24 * 60 * 60 },
      },
    });
  }
  return ordersQueue;
}

export function getProductsQueue(): Queue {
  if (!productsQueue) {
    productsQueue = new Queue(QUEUES.PRODUCTS, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: { count: 1000, age: 24 * 60 * 60 },
        removeOnFail: { count: 5000, age: 7 * 24 * 60 * 60 },
      },
    });
  }
  return productsQueue;
}

export function getInventoryPlannerQueue(): Queue {
  if (!inventoryPlannerQueue) {
    inventoryPlannerQueue = new Queue(QUEUES.INVENTORY_PLANNER, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 100, age: 24 * 60 * 60 },
        removeOnFail: { count: 500, age: 7 * 24 * 60 * 60 },
      },
    });
  }
  return inventoryPlannerQueue;
}

// ============================================================================
// Enqueue Helpers
// ============================================================================

const DEFAULT_JOB_OPTIONS: JobsOptions = {};

/**
 * Enqueue a job to create a picking task for orders
 */
export async function enqueueCreatePickingTask(
  data: CreatePickingTaskJobData,
  options?: JobsOptions,
) {
  const queue = getWorkTaskQueue();
  return queue.add(WORK_TASK_JOBS.CREATE_PICKING_TASK, data, {
    ...DEFAULT_JOB_OPTIONS,
    ...options,
    // Use idempotencyKey as job ID to prevent duplicates
    jobId: data.idempotencyKey,
  });
}

/**
 * Enqueue a job to assign a task to a user
 */
export async function enqueueAssignTask(
  data: AssignTaskJobData,
  options?: JobsOptions,
) {
  const queue = getWorkTaskQueue();
  return queue.add(WORK_TASK_JOBS.ASSIGN_TASK, data, {
    ...DEFAULT_JOB_OPTIONS,
    ...options,
  });
}

/**
 * Enqueue a job to start a task
 */
export async function enqueueStartTask(
  data: StartTaskJobData,
  options?: JobsOptions,
) {
  const queue = getWorkTaskQueue();
  return queue.add(WORK_TASK_JOBS.START_TASK, data, {
    ...DEFAULT_JOB_OPTIONS,
    ...options,
  });
}

/**
 * Enqueue a job to cancel a task
 */
export async function enqueueCancelTask(
  data: CancelTaskJobData,
  options?: JobsOptions,
) {
  const queue = getWorkTaskQueue();
  return queue.add(WORK_TASK_JOBS.CANCEL_TASK, data, {
    ...DEFAULT_JOB_OPTIONS,
    ...options,
  });
}

/**
 * Enqueue a Shopify order creation job
 */
export async function enqueueShopifyOrderCreate(
  data: ShopifyOrderCreateJobData,
  options?: JobsOptions,
) {
  const queue = getShopifyQueue();
  return queue.add(SHOPIFY_JOBS.ORDER_CREATE, data, {
    ...options,
    jobId: data.idempotencyKey, // Prevent duplicates
  });
}

/**
 * Enqueue a job to allocate a single order
 */
export async function enqueueAllocateOrder(
  data: AllocateOrderJobData,
  options?: JobsOptions,
) {
  const queue = getOrdersQueue();
  return queue.add(ORDER_JOBS.ALLOCATE_ORDER, data, {
    ...DEFAULT_JOB_OPTIONS,
    ...options,
    jobId: data.idempotencyKey || `allocate-${data.orderId}-${Date.now()}`,
  });
}

/**
 * Enqueue a job to allocate multiple orders
 */
export async function enqueueAllocateOrders(
  data: AllocateOrdersJobData,
  options?: JobsOptions,
) {
  const queue = getOrdersQueue();
  return queue.add(ORDER_JOBS.ALLOCATE_ORDERS, data, {
    ...DEFAULT_JOB_OPTIONS,
    ...options,
    jobId: data.idempotencyKey || `allocate-batch-${Date.now()}`,
  });
}

/**
 * Enqueue a job to release allocations for an order
 */
export async function enqueueReleaseAllocations(
  data: ReleaseAllocationsJobData,
  options?: JobsOptions,
) {
  const queue = getOrdersQueue();
  return queue.add(ORDER_JOBS.RELEASE_ALLOCATIONS, data, {
    ...DEFAULT_JOB_OPTIONS,
    ...options,
  });
}

/**
 * Enqueue a job to check backordered orders when inventory is received
 */
export async function enqueueCheckBackorders(
  data: CheckBackordersJobData,
  options?: JobsOptions,
) {
  const queue = getOrdersQueue();
  return queue.add(ORDER_JOBS.CHECK_BACKORDERS, data, {
    ...DEFAULT_JOB_OPTIONS,
    ...options,
  });
}

/**
 * Enqueue a bulk product import job
 */
export async function enqueueImportProducts(
  data: ImportProductsJobData,
  options?: JobsOptions,
) {
  const queue = getProductsQueue();
  return queue.add(PRODUCT_JOBS.IMPORT_PRODUCTS, data, {
    ...DEFAULT_JOB_OPTIONS,
    ...options,
    jobId: data.idempotencyKey,
  });
}

/**
 * Enqueue a single product import job
 */
export async function enqueueImportSingleProduct(
  data: ImportSingleProductJobData,
  options?: JobsOptions,
) {
  const queue = getProductsQueue();
  return queue.add(PRODUCT_JOBS.IMPORT_SINGLE, data, {
    ...DEFAULT_JOB_OPTIONS,
    ...options,
  });
}

/**
 * Enqueue a Shopify product sync job
 */
export async function enqueueSyncShopifyProducts(
  data: SyncShopifyProductsJobData,
  options?: JobsOptions,
) {
  const queue = getProductsQueue();
  return queue.add(PRODUCT_JOBS.SYNC_SHOPIFY_PRODUCTS, data, {
    ...DEFAULT_JOB_OPTIONS,
    ...options,
    jobId: data.idempotencyKey,
  });
}

export async function enqueueSyncInventoryPlanner(
  data: SyncInventoryPlannerJobData,
) {
  const queue = getInventoryPlannerQueue();
  return queue.add(INVENTORY_PLANNER_JOBS.SYNC_INVENTORY, data, {
    jobId: data.idempotencyKey,
  });
}

// ============================================================================
// Queue Management
// ============================================================================

/**
 * Get queue stats
 */
export async function getWorkTaskQueueStats() {
  const queue = getWorkTaskQueue();
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Inventory planner queue stats
 */
export async function getInventoryPlannerQueueStats() {
  const queue = getInventoryPlannerQueue();
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);
  return { waiting, active, completed, failed };
}

/**
 * Close all queues
 */
export async function closeQueues() {
  if (workTaskQueue) {
    await workTaskQueue.close();
    workTaskQueue = null;
  }
  if (shopifyQueue) {
    await shopifyQueue.close();
    shopifyQueue = null;
  }
  if (ordersQueue) {
    await ordersQueue.close();
    ordersQueue = null;
  }
  if (productsQueue) {
    await productsQueue.close();
    productsQueue = null;
  }

  if (inventoryPlannerQueue) {
    await inventoryPlannerQueue.close();
    inventoryPlannerQueue = null;
  }
}
