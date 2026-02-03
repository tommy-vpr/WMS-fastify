// /package/queue
// Connection
export { getConnection } from "./connection.js";

// Types
export * from "./types.js";

// Queues & Helpers
export {
  getWorkTaskQueue,
  getShopifyQueue,
  getOrdersQueue,
  getProductsQueue,
  enqueueCreatePickingTask,
  enqueueAssignTask,
  enqueueStartTask,
  enqueueCancelTask,
  enqueueShopifyOrderCreate,
  enqueueAllocateOrder,
  enqueueAllocateOrders,
  enqueueReleaseAllocations,
  enqueueCheckBackorders,
  enqueueImportProducts,
  enqueueImportSingleProduct,
  enqueueSyncShopifyProducts,
  getWorkTaskQueueStats,
  getInventoryPlannerQueue,
  enqueueSyncInventoryPlanner,
  getInventoryPlannerQueueStats,
  closeQueues,
  getFulfillmentQueue,
  enqueueCreateShippingLabel, // ← NEW (replaces enqueueAutoFulfill)
  enqueueShopifyFulfill, // ← NEW
} from "./queues.js";

// Shipping Queue (NEW)
export {
  SHIPPING_QUEUE,
  SHIPPING_JOBS,
  getShippingQueue,
  addShippingJob,
  // Types
  type CreateLabelJobData,
  type SyncShopifyFulfillmentJobData,
  type VoidLabelJobData,
} from "./shipping.js";
