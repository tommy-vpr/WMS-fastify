// export { prisma, PrismaClient } from "./client.js";
// export * from "../prisma/generated/client";

// Client
export { prisma, PrismaClient } from "./client.js";

// Prisma namespace (for error types, etc.)
export { Prisma } from "../prisma/generated/client/index.js";

// Prisma types
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
} from "../prisma/generated/client/index.js";

// Repositories
export * from "./repositories/index.js";
