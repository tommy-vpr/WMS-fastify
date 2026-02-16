// packages/db/src/repositories/index.ts

export {
  workTaskRepository,
  taskItemRepository,
  taskEventRepository,
} from "./work-task.repo.js";
export { allocationRepository } from "./allocation.repo.js";
export { inventoryRepository } from "./inventory.repo.js";
export { orderRepository } from "./order.repo.js";

// Use named exports instead of export *
export { productRepository } from "./product.repo.js";
export { orderPackageRepository } from "./order-package.repo.js";

// Fulfillment pipeline
export { pickingRepository } from "./picking.repo.js";
export type { PickingRepository } from "./picking.repo.js";

export { packingRepository } from "./packing.repo.js";
export type { PackingRepository } from "./packing.repo.js";

export { fulfillmentRepository } from "./fulfillment.repo.js";
export type {
  FulfillmentRepository,
  FulfillmentWorkTask,
} from "./fulfillment.repo.js";
