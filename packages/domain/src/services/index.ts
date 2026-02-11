// packages/domain/src/services/index.ts

// Order management
export * from "./order.service.js";
export * from "./order-allocation.service.js";

// Inventory management
export * from "./inventory.service.js";
export * from "./inventory-planner.service.js";
export {
  LocationService,
  LocationImportError,
  type LocationServiceLocationRepo,
  type LocationServiceVariantRepo,
  type LocationServiceInventoryRepo,
  type LocationServiceAuditRepo,
  type LocationImportRow,
  type LocationImportResult,
  type LocationRecord,
  type UnassignedVariant,
} from "./location.service.js";

// Fulfillment pipeline (split services)
export { PickingService, type PickingServiceDeps } from "./picking.service.js";
export { PackingService, type PackingServiceDeps } from "./packing.service.js";
export {
  FulfillmentService,
  type FulfillmentServiceDeps,
  type FulfillmentStatusResult,
  type ScanLookup,
  type PickScanDetail,
  type ScanItemDetail,
  type PackingImageDetail,
} from "./fulfillmentIndividual.service.js";

// Shipping management
export * from "./fulfillment.service.js";

// Shipping management
export * from "./shipping.service.js";

// Product management
export * from "./product.service.js";

// Work tasks
export * from "./work-task.service.js";

// Receiving management
export * from "./receiving.service.js";

// Cycle Count
export * from "./cycle-count.service.js";

// GCP
export {
  PackingImageService,
  PACKING_IMAGE_EVENTS,
  type PackingImage,
  type UploadPackingImageInput,
  type PackingImageWithUploader,
} from "./packing-image.service.js";

export {
  StorageService,
  getStorageService,
  type UploadResult,
  type StorageConfig,
} from "./storage.service.js";
