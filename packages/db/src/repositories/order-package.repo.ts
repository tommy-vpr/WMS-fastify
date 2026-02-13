/**
 * OrderPackage Repository
 * Prisma implementation for OrderPackage persistence
 *
 * Save to: packages/db/src/repositories/order-package.repository.ts
 */

import { PrismaClient, Prisma } from "../generated/client/index.js";
import type {
  OrderPackageRepository,
  CreatePackageInput,
  UpdatePackageInput,
  PackedPackageInput,
  OrderPackageRecord,
  OrderPackageItemRecord,
  CreatePackageItemInput,
} from "@wms/domain";
import type { OrderItemInput } from "@wms/domain";

// =============================================================================
// Helper: map Prisma result to domain record
// =============================================================================

function toRecord(row: any): OrderPackageRecord {
  return {
    id: row.id,
    orderId: row.orderId,
    sequence: row.sequence,
    boxId: row.boxId,
    boxLabel: row.boxLabel,
    length: row.length ? Number(row.length) : null,
    width: row.width ? Number(row.width) : null,
    height: row.height ? Number(row.height) : null,
    dimensionUnit: row.dimensionUnit,
    estimatedWeight: row.estimatedWeight ? Number(row.estimatedWeight) : null,
    actualWeight: row.actualWeight ? Number(row.actualWeight) : null,
    weightUnit: row.weightUnit,
    status: row.status,
    items: (row.items ?? []).map(toItemRecord),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toItemRecord(row: any): OrderPackageItemRecord {
  return {
    id: row.id,
    orderPackageId: row.orderPackageId,
    productVariantId: row.productVariantId,
    sku: row.sku,
    quantity: row.quantity,
    unitWeight: row.unitWeight ? Number(row.unitWeight) : null,
    unitWeightUnit: row.unitWeightUnit,
  };
}

const includeItems = { items: { include: { productVariant: true } } } as const;

// =============================================================================
// Repository
// =============================================================================

export function createOrderPackageRepository(
  prisma: PrismaClient,
): OrderPackageRepository {
  return {
    // ─────────────────────────────────────────────────────────────────────
    // Load order items with variant dimensions for recommendation
    // ─────────────────────────────────────────────────────────────────────

    async findOrderItemsWithDimensions(
      orderId: string,
    ): Promise<OrderItemInput[]> {
      const items = await prisma.orderItem.findMany({
        where: { orderId, matched: true, productVariantId: { not: null } },
        include: {
          productVariant: {
            select: {
              id: true,
              sku: true,
              name: true,
              weight: true,
              weightUnit: true,
              length: true,
              width: true,
              height: true,
              dimensionUnit: true,
            },
          },
        },
      });

      return items
        .filter((i) => i.productVariant)
        .map((i) => ({
          productVariantId: i.productVariant!.id,
          sku: i.productVariant!.sku,
          name: i.productVariant!.name,
          quantity: i.quantity,
          weight: i.productVariant!.weight
            ? Number(i.productVariant!.weight)
            : null,
          weightUnit: i.productVariant!.weightUnit,
          length: i.productVariant!.length
            ? Number(i.productVariant!.length)
            : null,
          width: i.productVariant!.width
            ? Number(i.productVariant!.width)
            : null,
          height: i.productVariant!.height
            ? Number(i.productVariant!.height)
            : null,
          dimensionUnit: i.productVariant!.dimensionUnit,
        }));
    },

    // ─────────────────────────────────────────────────────────────────────
    // Delete DRAFT packages (for re-recommendation)
    // ─────────────────────────────────────────────────────────────────────

    async deleteDraftPackages(orderId: string): Promise<number> {
      const result = await prisma.orderPackage.deleteMany({
        where: { orderId, status: "DRAFT" },
      });
      return result.count;
    },

    // ─────────────────────────────────────────────────────────────────────
    // Create packages with items in a single transaction
    // ─────────────────────────────────────────────────────────────────────

    async createPackages(
      orderId: string,
      packages: CreatePackageInput[],
    ): Promise<OrderPackageRecord[]> {
      const created = await prisma.$transaction(
        packages.map((pkg) =>
          prisma.orderPackage.create({
            data: {
              orderId,
              sequence: pkg.sequence,
              boxId: pkg.boxId,
              boxLabel: pkg.boxLabel,
              length: pkg.length,
              width: pkg.width,
              height: pkg.height,
              dimensionUnit: pkg.dimensionUnit,
              estimatedWeight: pkg.estimatedWeight,
              weightUnit: pkg.weightUnit,
              status: "DRAFT",
              items: {
                create: pkg.items.map((item) => ({
                  productVariantId: item.productVariantId,
                  sku: item.sku,
                  quantity: item.quantity,
                  unitWeight: item.unitWeight,
                  unitWeightUnit: item.unitWeightUnit,
                })),
              },
            },
            include: includeItems,
          }),
        ),
      );

      return created.map(toRecord);
    },

    // ─────────────────────────────────────────────────────────────────────
    // Find all packages for an order
    // ─────────────────────────────────────────────────────────────────────

    async findByOrderId(orderId: string): Promise<OrderPackageRecord[]> {
      const packages = await prisma.orderPackage.findMany({
        where: { orderId },
        include: includeItems,
        orderBy: { sequence: "asc" },
      });

      return packages.map(toRecord);
    },

    // ─────────────────────────────────────────────────────────────────────
    // Update package (box selection, dimensions, weight override)
    // ─────────────────────────────────────────────────────────────────────

    async updatePackage(
      packageId: string,
      data: UpdatePackageInput,
    ): Promise<OrderPackageRecord> {
      const updated = await prisma.orderPackage.update({
        where: { id: packageId },
        data: {
          boxId: data.boxId !== undefined ? data.boxId : undefined,
          boxLabel: data.boxLabel !== undefined ? data.boxLabel : undefined,
          length: data.length !== undefined ? data.length : undefined,
          width: data.width !== undefined ? data.width : undefined,
          height: data.height !== undefined ? data.height : undefined,
          actualWeight:
            data.actualWeight !== undefined ? data.actualWeight : undefined,
          weightUnit: data.weightUnit,
        },
        include: includeItems,
      });

      return toRecord(updated);
    },

    // ─────────────────────────────────────────────────────────────────────
    // Replace items in a package (packer redistributes)
    // ─────────────────────────────────────────────────────────────────────

    async replacePackageItems(
      packageId: string,
      items: CreatePackageItemInput[],
    ): Promise<void> {
      await prisma.$transaction([
        prisma.orderPackageItem.deleteMany({
          where: { orderPackageId: packageId },
        }),
        ...items.map((item) =>
          prisma.orderPackageItem.create({
            data: {
              orderPackageId: packageId,
              productVariantId: item.productVariantId,
              sku: item.sku,
              quantity: item.quantity,
              unitWeight: item.unitWeight,
              unitWeightUnit: item.unitWeightUnit,
            },
          }),
        ),
      ]);
    },

    // ─────────────────────────────────────────────────────────────────────
    // Mark packages as PACKED with actual weights
    // ─────────────────────────────────────────────────────────────────────

    async markPacked(
      orderId: string,
      packData: PackedPackageInput[],
    ): Promise<void> {
      await prisma.$transaction(
        packData.map((pd) =>
          prisma.orderPackage.update({
            where: { id: pd.packageId },
            data: {
              status: "PACKED",
              actualWeight: pd.actualWeight,
              weightUnit: pd.weightUnit ?? "oz",
              ...(pd.length && { length: pd.length }),
              ...(pd.width && { width: pd.width }),
              ...(pd.height && { height: pd.height }),
            },
          }),
        ),
      );
    },

    // ─────────────────────────────────────────────────────────────────────
    // Mark all packages as SHIPPED
    // ─────────────────────────────────────────────────────────────────────

    async markShipped(orderId: string): Promise<void> {
      await prisma.orderPackage.updateMany({
        where: { orderId, status: "PACKED" },
        data: { status: "SHIPPED" },
      });
    },

    // ─────────────────────────────────────────────────────────────────────
    // Delete a single package
    // ─────────────────────────────────────────────────────────────────────

    async deletePackage(packageId: string): Promise<void> {
      await prisma.orderPackage.delete({
        where: { id: packageId },
      });
    },

    // ─────────────────────────────────────────────────────────────────────
    // Add empty package to order
    // ─────────────────────────────────────────────────────────────────────

    async addPackage(
      orderId: string,
      sequence: number,
    ): Promise<OrderPackageRecord> {
      const created = await prisma.orderPackage.create({
        data: {
          orderId,
          sequence,
          status: "DRAFT",
          weightUnit: "oz",
          dimensionUnit: "in",
        },
        include: includeItems,
      });

      return toRecord(created);
    },
  };
}
