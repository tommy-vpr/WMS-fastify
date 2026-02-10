/**
 * FulfillmentService (Read-Only Facade)
 * Handles fulfillment status queries, scan lookup building, and SSE event replay
 *
 * Save to: packages/domain/src/services/fulfillment.service.ts
 *
 * This replaces the monolithic FulfillmentService.
 * Mutations are now in PickingService and PackingService.
 */

import type { FulfillmentEvent } from "@wms/pubsub";
import type { FulfillmentRepository, FulfillmentWorkTask } from "@wms/db";

// =============================================================================
// Exported Types (preserved for frontend compatibility)
// =============================================================================

export interface PackingImageDetail {
  id: string;
  url: string;
  filename: string;
  notes: string | null;
  uploadedAt: Date;
  uploadedBy: { id: string; name: string | null };
}

export interface ScanItemDetail {
  taskItemId: string;
  sequence: number;
  status: string;
  quantityRequired: number;
  quantityCompleted: number;
  expectedItemBarcodes: string[];
  sku: string | null;
  variantName: string | null;
  imageUrl: string | null;
}

export interface PickScanDetail extends ScanItemDetail {
  expectedLocationBarcode: string | null;
  locationName: string | null;
  locationDetail: {
    zone: string | null;
    aisle: string | null;
    rack: string | null;
    shelf: string | null;
    bin: string | null;
  } | null;
}

export interface ScanLookup {
  pick: Record<string, PickScanDetail>;
  pack: Record<string, ScanItemDetail>;
  barcodeLookup: Record<string, { taskItemId: string; type: "pick" | "pack" }>;
}

export interface FulfillmentStatusResult {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    trackingNumber: string | null;
    shippedAt: Date | null;
    createdAt: Date;
    customerName: string;
    shippingAddress: unknown;
    priority: string;
    items: Array<{
      id: string;
      sku: string;
      quantity: number;
      quantityPicked: number;
      productVariant: {
        id: string;
        sku: string;
        upc: string | null;
        barcode: string | null;
        name: string;
        imageUrl: string | null;
      } | null;
    }>;
  };
  packingImages: PackingImageDetail[];
  currentStep: string;
  picking: FulfillmentWorkTask | null;
  packing: FulfillmentWorkTask | null;
  shipping: {
    id: string;
    orderId: string;
    carrier: string;
    service: string;
    trackingNumber: string;
    trackingUrl: string | null;
    rate: unknown;
    labelUrl: string | null;
    status: string;
    createdAt: Date;
  } | null;
  events: Array<{
    id: string;
    orderId: string | null;
    type: string;
    payload: unknown;
    correlationId: string | null;
    userId: string | null;
    createdAt: Date;
  }>;
  scanLookup: ScanLookup;
  pickBin: {
    id: string;
    binNumber: string;
    barcode: string;
    status: string;
    items: Array<{
      id: string;
      sku: string;
      quantity: number;
      verifiedQty: number;
      productVariant: {
        id: string;
        sku: string;
        upc: string | null;
        barcode: string | null;
        name: string;
        imageUrl: string | null;
      };
    }>;
  } | null;
}

// =============================================================================
// Service
// =============================================================================

export interface FulfillmentServiceDeps {
  fulfillmentRepo: FulfillmentRepository;
}

export class FulfillmentService {
  private repo: FulfillmentRepository;

  constructor(deps: FulfillmentServiceDeps) {
    this.repo = deps.fulfillmentRepo;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Get Fulfillment Status
  // ─────────────────────────────────────────────────────────────────────────

  async getFulfillmentStatus(
    orderId: string,
  ): Promise<FulfillmentStatusResult> {
    const data = await this.repo.getFulfillmentStatusData(orderId);
    if (!data.order) throw new Error(`Order ${orderId} not found`);

    const { order, pickTasks, packTasks, labels, events, pickBin } = data;

    // Determine current step
    const currentStep = this.resolveCurrentStep(order.status);

    // Build scan lookup maps
    const activePickTask =
      pickTasks.find((t) => t.status !== "CANCELLED") ?? null;
    const activePackTask =
      packTasks.find((t) => t.status !== "CANCELLED") ?? null;
    const scanLookup = this.buildScanLookup(activePickTask, activePackTask);

    return {
      order,
      packingImages: order.packingImages.map((img) => ({
        id: img.id,
        url: img.url,
        filename: img.filename,
        notes: img.notes,
        uploadedAt: img.createdAt,
        uploadedBy: { id: img.uploader.id, name: img.uploader.name },
      })),
      currentStep,
      picking: activePickTask,
      packing: activePackTask,
      shipping: labels[0]
        ? {
            id: labels[0].id,
            orderId: labels[0].orderId,
            carrier: labels[0].carrierCode,
            service: labels[0].serviceCode,
            trackingNumber: labels[0].trackingNumber || "",
            trackingUrl: null,
            rate: labels[0].cost,
            labelUrl: labels[0].labelUrl,
            status: labels[0].voidedAt ? "VOIDED" : "PURCHASED",
            createdAt: labels[0].createdAt,
          }
        : null,
      events,
      scanLookup,
      pickBin: pickBin
        ? {
            id: pickBin.id,
            binNumber: pickBin.binNumber,
            barcode: pickBin.barcode,
            status: pickBin.status,
            items: pickBin.items.map((item) => ({
              id: item.id,
              sku: item.sku,
              quantity: item.quantity,
              verifiedQty: item.verifiedQty,
              productVariant: item.productVariant,
            })),
          }
        : null,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event Replay (SSE catch-up)
  // ─────────────────────────────────────────────────────────────────────────

  async getEventsSince(
    orderId: string,
    sinceEventId?: string,
  ): Promise<FulfillmentEvent[]> {
    let since: Date | undefined;
    if (sinceEventId) {
      const ref = await this.repo.findEventById(sinceEventId);
      since = ref?.createdAt;
    }

    const events = await this.repo.findEventsSince(orderId, since);

    return events.map((e) => ({
      id: e.id,
      type: e.type as FulfillmentEvent["type"],
      orderId: e.orderId ?? undefined,
      payload: e.payload as Record<string, unknown>,
      correlationId: e.correlationId ?? undefined,
      userId: e.userId ?? undefined,
      timestamp: e.createdAt.toISOString(),
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private resolveCurrentStep(status: string): string {
    switch (status) {
      case "PENDING":
      case "CONFIRMED":
      case "READY_TO_PICK":
      case "ALLOCATED":
        return "awaiting_pick";
      case "PICKING":
        return "picking";
      case "PICKED":
        return "awaiting_pack";
      case "PACKING":
        return "packing";
      case "PACKED":
        return "awaiting_ship";
      case "SHIPPED":
        return "shipped";
      case "DELIVERED":
        return "delivered";
      default:
        return status.toLowerCase();
    }
  }

  private buildScanLookup(
    pickTask: FulfillmentWorkTask | null,
    packTask: FulfillmentWorkTask | null,
  ): ScanLookup {
    const pickScanLookup: Record<string, PickScanDetail> = {};
    const packScanLookup: Record<string, ScanItemDetail> = {};
    const barcodeLookup: Record<
      string,
      { taskItemId: string; type: "pick" | "pack" }
    > = {};

    if (pickTask) {
      for (const ti of pickTask.taskItems) {
        const barcodes: string[] = [];
        if (ti.productVariant?.upc) barcodes.push(ti.productVariant.upc);
        if (ti.productVariant?.barcode)
          barcodes.push(ti.productVariant.barcode);
        if (ti.productVariant?.sku) barcodes.push(ti.productVariant.sku);

        pickScanLookup[ti.id] = {
          taskItemId: ti.id,
          sequence: ti.sequence,
          status: ti.status,
          quantityRequired: ti.quantityRequired,
          quantityCompleted: ti.quantityCompleted,
          expectedItemBarcodes: barcodes,
          expectedLocationBarcode: ti.location?.barcode ?? null,
          sku: ti.productVariant?.sku ?? null,
          variantName: ti.productVariant?.name ?? null,
          imageUrl: ti.productVariant?.imageUrl ?? null,
          locationName: ti.location?.name ?? null,
          locationDetail: ti.location
            ? {
                zone: ti.location.zone,
                aisle: ti.location.aisle,
                rack: ti.location.rack,
                shelf: ti.location.shelf,
                bin: ti.location.bin,
              }
            : null,
        };
      }
    }

    if (packTask) {
      for (const ti of packTask.taskItems) {
        const barcodes: string[] = [];
        if (ti.productVariant?.upc) barcodes.push(ti.productVariant.upc);
        if (ti.productVariant?.barcode)
          barcodes.push(ti.productVariant.barcode);
        if (ti.productVariant?.sku) barcodes.push(ti.productVariant.sku);

        packScanLookup[ti.id] = {
          taskItemId: ti.id,
          sequence: ti.sequence,
          status: ti.status,
          quantityRequired: ti.quantityRequired,
          quantityCompleted: ti.quantityCompleted,
          expectedItemBarcodes: barcodes,
          sku: ti.productVariant?.sku ?? null,
          variantName: ti.productVariant?.name ?? null,
          imageUrl: ti.productVariant?.imageUrl ?? null,
        };
      }
    }

    // Build reverse lookup: barcode → taskItemId
    for (const [taskItemId, data] of Object.entries(pickScanLookup)) {
      if (
        data.status !== "COMPLETED" &&
        data.status !== "SKIPPED" &&
        data.status !== "SHORT"
      ) {
        for (const bc of data.expectedItemBarcodes) {
          barcodeLookup[bc] = { taskItemId, type: "pick" };
        }
      }
    }

    for (const [taskItemId, data] of Object.entries(packScanLookup)) {
      if (data.status !== "COMPLETED") {
        for (const bc of data.expectedItemBarcodes) {
          barcodeLookup[bc] = { taskItemId, type: "pack" };
        }
      }
    }

    return { pick: pickScanLookup, pack: packScanLookup, barcodeLookup };
  }
}
