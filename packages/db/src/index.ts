export { prisma, PrismaClient } from "./client.js";
export * from "@prisma/client";
export * from "./repositories/index.js";

// Prisma enums / types
export type {
  OrderStatus,
  PaymentStatus,
  Priority,
  InventoryStatus,
  AllocationStatus,
  WorkTaskType,
  WorkTaskStatus,
  WorkTaskBlockReason,
  WorkTaskItemStatus,
  WorkTaskEventType,
  LocationType,
  UserRole,
} from "@prisma/client";
