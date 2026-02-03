/**
 * Fulfillment Detail Page
 * Step-by-step pick → pack → ship workflow for a single order.
 * Supports TC22 Zebra barcode scanner with client-side validation.
 *
 * Save to: apps/web/src/pages/fulfillment/FulfillmentDetail.tsx
 *
 * Route: /fulfillment/:orderId
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Package,
  ScanBarcode,
  CheckCircle2,
  Truck,
  BoxIcon,
  MapPin,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  XCircle,
  Clock,
  Wifi,
  WifiOff,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { useFulfillmentStream } from "@/hooks/useFulfillmentStream";
import ShippingLabelForm from "@/components/shipping/ShippingLabelForm";

// ============================================================================
// Types
// ============================================================================

interface PickScanDetail {
  taskItemId: string;
  sequence: number;
  status: string;
  quantityRequired: number;
  quantityCompleted: number;
  expectedItemBarcodes: string[];
  expectedLocationBarcode: string | null;
  sku: string | null;
  variantName: string | null;
  imageUrl: string | null;
  locationName: string | null;
  locationDetail: {
    zone: string | null;
    aisle: string | null;
    rack: string | null;
    shelf: string | null;
    bin: string | null;
  } | null;
}

interface PackScanDetail {
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

interface ScanLookup {
  pick: Record<string, PickScanDetail>;
  pack: Record<string, PackScanDetail>;
  barcodeLookup: Record<string, { taskItemId: string; type: "pick" | "pack" }>;
}

interface TaskItem {
  id: string;
  sequence: number;
  status: string;
  quantityRequired: number;
  quantityCompleted: number;
  productVariant: {
    id: string;
    sku: string;
    upc: string | null;
    barcode: string | null;
    name: string;
    imageUrl: string | null;
  } | null;
  location?: {
    id: string;
    name: string;
    barcode: string | null;
    zone: string | null;
    aisle: string | null;
    rack: string | null;
    shelf: string | null;
    bin: string | null;
  } | null;
}

interface WorkTask {
  id: string;
  taskNumber: string;
  type: string;
  status: string;
  totalItems: number;
  completedItems: number;
  taskItems: TaskItem[];
  // Add these for packing:
  packedWeight?: number;
  packedWeightUnit?: string;
  packedDimensions?: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
}

interface FulfillmentStatus {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    trackingNumber: string | null;
    shippedAt: string | null;
    createdAt: string;
    customerName: string;
    shippingAddress: any;
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
  currentStep: string;
  picking: WorkTask | null;
  packing: {
    id: string;
    taskNumber: string;
    type: string;
    status: string;
    totalItems: number;
    completedItems: number;
    taskItems: TaskItem[];
    packedWeight?: number;
    packedWeightUnit?: string;
    packedDimensions?: {
      length: number;
      width: number;
      height: number;
      unit: string;
    };
  } | null;
  shipping: {
    id: string;
    carrier: string;
    service: string;
    trackingNumber: string;
    trackingUrl: string | null;
    rate: number;
    labelUrl: string | null;
    createdAt: string;
  } | null;
  events: Array<{
    id: string;
    type: string;
    payload: any;
    createdAt: string;
  }>;
  scanLookup: ScanLookup;
}

// ============================================================================
// Constants
// ============================================================================

const STEPS = [
  { key: "awaiting_pick", label: "Allocated", icon: Package },
  { key: "picking", label: "Picking", icon: ScanBarcode },
  { key: "awaiting_pack", label: "Picked", icon: CheckCircle2 },
  { key: "packing", label: "Packing", icon: BoxIcon },
  { key: "awaiting_ship", label: "Packed", icon: Package },
  { key: "shipped", label: "Shipped", icon: Truck },
] as const;

type ScanPhase = "scan_location" | "scan_item";

// ============================================================================
// Main Component
// ============================================================================

export default function FulfillmentDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  // ── State ───────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<FulfillmentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showTimeline, setShowTimeline] = useState(true);

  // Pick scan state
  const [scanPhase, setScanPhase] = useState<ScanPhase>("scan_location");
  const [scanFeedback, setScanFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pack form state
  const [packWeight, setPackWeight] = useState("");
  const [packWeightUnit, setPackWeightUnit] = useState("ounce");
  const [packLength, setPackLength] = useState("");
  const [packWidth, setPackWidth] = useState("");
  const [packHeight, setPackHeight] = useState("");

  // ── SSE for live events ─────────────────────────────────────────────────
  const { events: sseEvents, connected } = useFulfillmentStream({
    orderId,
    enabled: !!orderId,
  });

  // Refetch when meaningful SSE events arrive
  const lastSseEventId = useRef<string | null>(null);
  useEffect(() => {
    if (sseEvents.length === 0) return;
    const latest = sseEvents[sseEvents.length - 1];
    if (latest?.id && latest.id !== lastSseEventId.current) {
      lastSseEventId.current = latest.id;
      // Refetch on state-changing events from other clients
      const stateEvents = [
        "order:",
        "picklist:completed",
        "packing:completed",
        "shipping:",
      ];
      if (stateEvents.some((p) => latest.type?.startsWith(p))) {
        fetchStatus();
      }
    }
  }, [sseEvents]);

  // ── Data Fetching ───────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    if (!orderId) return;
    try {
      const data = await apiClient.get<FulfillmentStatus>(
        `/fulfillment/${orderId}/status`,
      );
      setStatus(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ── Scan Feedback Helper ────────────────────────────────────────────────
  const showFeedback = (type: "success" | "error", message: string) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setScanFeedback({ type, message });
    feedbackTimer.current = setTimeout(() => setScanFeedback(null), 2500);
  };

  // ── Get Current Pick Item ───────────────────────────────────────────────
  const getCurrentPickItem = (): PickScanDetail | null => {
    if (!status?.scanLookup?.pick) return null;
    const items = Object.values(status.scanLookup.pick).sort(
      (a, b) => a.sequence - b.sequence,
    );
    return (
      items.find(
        (i) =>
          i.status !== "COMPLETED" &&
          i.status !== "SKIPPED" &&
          i.status !== "SHORT",
      ) || null
    );
  };

  // ── Get Current Pack Item ───────────────────────────────────────────────
  const getCurrentPackItem = (): PackScanDetail | null => {
    if (!status?.scanLookup?.pack) return null;
    const items = Object.values(status.scanLookup.pack).sort(
      (a, b) => a.sequence - b.sequence,
    );
    return items.find((i) => i.status !== "COMPLETED") || null;
  };

  // ── Barcode Scanner Handler ─────────────────────────────────────────────
  const handleScan = useCallback(
    async (barcode: string) => {
      if (!status || actionLoading) return;

      const step = status.currentStep;

      // ── PICKING: two-phase scan ──────────────────────────────────────
      if (step === "picking") {
        const current = getCurrentPickItem();
        if (!current) return;

        if (scanPhase === "scan_location") {
          // Validate location barcode
          if (!current.expectedLocationBarcode) {
            // No location barcode configured — skip to item scan
            setScanPhase("scan_item");
            showFeedback("success", "No location barcode — scan item");
            return;
          }

          if (barcode === current.expectedLocationBarcode) {
            setScanPhase("scan_item");
            showFeedback("success", `✓ Location: ${current.locationName}`);
          } else {
            showFeedback(
              "error",
              `✗ Wrong location — expected ${current.locationName}`,
            );
          }
          return;
        }

        if (scanPhase === "scan_item") {
          // Validate item barcode
          if (current.expectedItemBarcodes.includes(barcode)) {
            // Auto-confirm the pick
            await confirmPick(current.taskItemId, current.quantityRequired);
            setScanPhase("scan_location");
            showFeedback("success", `✓ Picked: ${current.sku}`);
          } else {
            showFeedback("error", `✗ Wrong item — expected ${current.sku}`);
          }
          return;
        }
      }

      // ── PACKING: single scan to verify ───────────────────────────────
      if (step === "packing") {
        const lookup = status.scanLookup.barcodeLookup[barcode];
        if (lookup && lookup.type === "pack") {
          await verifyPackItem(lookup.taskItemId);
          const packDetail = status.scanLookup.pack[lookup.taskItemId];
          showFeedback("success", `✓ Verified: ${packDetail?.sku || barcode}`);
        } else {
          showFeedback("error", `✗ Unknown barcode: ${barcode}`);
        }
        return;
      }
    },
    [status, actionLoading, scanPhase],
  );

  useBarcodeScanner({
    onScan: handleScan,
    enabled:
      !loading &&
      (status?.currentStep === "picking" || status?.currentStep === "packing"),
  });

  // ── Actions ─────────────────────────────────────────────────────────────
  async function generatePickList() {
    if (!orderId || actionLoading) return;
    setActionLoading(true);
    try {
      await apiClient.post(`/fulfillment/${orderId}/pick`);
      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmPick(taskItemId: string, quantity: number) {
    if (!orderId || actionLoading) return;
    setActionLoading(true);
    try {
      await apiClient.post(
        `/fulfillment/${orderId}/pick/${taskItemId}/confirm`,
        { quantity, locationScanned: true, itemScanned: true },
      );
      await fetchStatus();
      setScanPhase("scan_location");
    } catch (err: any) {
      showFeedback("error", err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function generatePackList() {
    if (!orderId || actionLoading) return;
    setActionLoading(true);
    try {
      await apiClient.post(`/fulfillment/${orderId}/pack`);
      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function verifyPackItem(taskItemId: string) {
    if (!orderId || actionLoading) return;
    setActionLoading(true);
    try {
      await apiClient.post(`/fulfillment/${orderId}/pack/${taskItemId}/verify`);
      await fetchStatus();
    } catch (err: any) {
      showFeedback("error", err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function completePacking() {
    if (!orderId || !status?.packing || actionLoading) return;
    const weight = parseFloat(packWeight);
    if (!weight || weight <= 0) {
      setError("Enter a valid weight");
      return;
    }
    setActionLoading(true);
    try {
      await apiClient.post(`/fulfillment/${orderId}/pack/complete`, {
        taskId: status.packing.id,
        weight,
        weightUnit: packWeightUnit,
        dimensions:
          packLength && packWidth && packHeight
            ? {
                length: parseFloat(packLength),
                width: parseFloat(packWidth),
                height: parseFloat(packHeight),
                unit: "inch",
              }
            : undefined,
      });
      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  // ── Loading / Error States ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error || "Order not found"}
        </div>
        <Link
          to="/fulfillment"
          className="mt-4 inline-flex items-center gap-1 text-blue-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Back to fulfillment
        </Link>
      </div>
    );
  }

  const { order, currentStep, picking, packing, shipping, scanLookup } = status;

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/fulfillment")}
            className="cursor-pointer p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl lg:text-2xl font-bold">
                {order.orderNumber}
              </h1>
              <OrderStatusBadge status={order.status} />
              {order.priority !== "NORMAL" && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                  {order.priority}
                </span>
              )}
            </div>
            <p className="text-gray-500 text-sm">
              {order.customerName} · {order.items.length} item
              {order.items.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            {connected ? (
              <Wifi className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-red-400" />
            )}
            <span>{connected ? "Live" : "Offline"}</span>
          </div>
          <button
            onClick={fetchStatus}
            className="cursor-pointer p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Scan Feedback Toast ──────────────────────────────────────────── */}
      {scanFeedback && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
            scanFeedback.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {scanFeedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <XCircle className="w-4 h-4" />
          )}
          {scanFeedback.message}
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
          <button
            onClick={() => setError(null)}
            className="cursor-pointer ml-auto text-red-400 hover:text-red-600"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Step Progress ────────────────────────────────────────────────── */}
      <StepProgress currentStep={currentStep} />

      {/* ── Main Layout ──────────────────────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Main content area (2 cols on desktop) */}
        <div className="lg:col-span-2 space-y-4">
          {/* ── STEP: Awaiting Pick ──────────────────────────────────────── */}
          {currentStep === "awaiting_pick" && (
            <StepCard
              title="Ready to Pick"
              description={`${order.items.length} item${order.items.length !== 1 ? "s" : ""} allocated and ready for picking.`}
              icon={<Package className="w-5 h-5 text-blue-500" />}
            >
              <div className="space-y-2 mb-4">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 text-sm bg-gray-50 rounded-lg p-3"
                  >
                    <span className="font-mono text-blue-600 font-medium">
                      {item.sku}
                    </span>
                    <span className="text-gray-600 flex-1">
                      {item.productVariant?.name || "—"}
                    </span>
                    <span className="font-medium">×{item.quantity}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={generatePickList}
                disabled={actionLoading}
                className="cursor-pointer w-full py-3 bg-blue-600 text-white rounded-lg 
                font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center 
                justify-center gap-2 transition"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ScanBarcode className="w-4 h-4" />
                )}
                Generate Pick List
              </button>
            </StepCard>
          )}

          {/* ── STEP: Picking ────────────────────────────────────────────── */}
          {currentStep === "picking" && picking && (
            <StepCard
              title={`Picking (${picking.completedItems}/${picking.totalItems})`}
              description="Scan location barcode, then item barcode to confirm each pick."
              icon={<ScanBarcode className="w-5 h-5 text-blue-500" />}
            >
              {/* Progress bar */}
              <div className="mb-4">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{
                      width: `${picking.totalItems > 0 ? (picking.completedItems / picking.totalItems) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Current pick item */}
              {(() => {
                const current = getCurrentPickItem();
                if (!current) {
                  return (
                    <div className="text-center py-6 text-green-600 font-medium">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
                      All items picked!
                    </div>
                  );
                }

                return (
                  <div className="mb-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                      Current Item
                    </div>
                    <div className="bg-white border-2 border-blue-200 rounded-xl p-4">
                      {/* Location */}
                      <div className="flex items-center gap-2 mb-3">
                        <MapPin className="w-4 h-4 text-blue-500" />
                        <span className="font-semibold text-blue-700">
                          {current.locationName || "No location"}
                        </span>
                        {current.locationDetail && (
                          <span className="text-xs text-gray-400">
                            {[
                              current.locationDetail.zone &&
                                `Zone ${current.locationDetail.zone}`,
                              current.locationDetail.aisle &&
                                `Aisle ${current.locationDetail.aisle}`,
                              current.locationDetail.rack &&
                                `Rack ${current.locationDetail.rack}`,
                              current.locationDetail.shelf &&
                                `Shelf ${current.locationDetail.shelf}`,
                              current.locationDetail.bin &&
                                `Bin ${current.locationDetail.bin}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
                      </div>

                      {/* Scan phase indicator */}
                      <div className="flex gap-2 mb-3">
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded ${
                            scanPhase === "scan_location"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {scanPhase === "scan_location"
                            ? "① Scan Location"
                            : "✓ Location OK"}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded ${
                            scanPhase === "scan_item"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          {scanPhase === "scan_item"
                            ? "② Scan Item"
                            : "② Scan Item"}
                        </span>
                      </div>

                      {/* Product info */}
                      <div className="flex items-center gap-3">
                        {current.imageUrl ? (
                          <img
                            src={current.imageUrl}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover bg-gray-100"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Package className="w-6 h-6 text-gray-300" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="font-medium">
                            {current.variantName || "Unknown"}
                          </div>
                          <div className="text-sm text-gray-500 font-mono">
                            {current.sku}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">
                            ×{current.quantityRequired}
                          </div>
                        </div>
                      </div>

                      {/* Manual confirm button */}
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() =>
                            confirmPick(
                              current.taskItemId,
                              current.quantityRequired,
                            )
                          }
                          disabled={actionLoading}
                          className="cursor-pointer flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-1 transition"
                        >
                          {actionLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          Manual Confirm
                        </button>
                        {current.expectedLocationBarcode &&
                          scanPhase === "scan_location" && (
                            <button
                              onClick={() => setScanPhase("scan_item")}
                              className="cursor-pointer px-3 py-2 border border-border rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition"
                            >
                              Skip Location
                            </button>
                          )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* All pick items list */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                  All Items
                </div>
                <div className="space-y-1">
                  {Object.values(scanLookup.pick)
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((item) => {
                      const isDone =
                        item.status === "COMPLETED" ||
                        item.status === "SHORT" ||
                        item.status === "SKIPPED";
                      const isCurrent =
                        getCurrentPickItem()?.taskItemId === item.taskItemId;

                      return (
                        <div
                          key={item.taskItemId}
                          className={`flex items-center gap-3 p-2 rounded-lg text-sm ${
                            isCurrent
                              ? "bg-blue-50 border border-blue-200"
                              : isDone
                                ? "bg-gray-50 opacity-60"
                                : "bg-gray-50"
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                              isDone
                                ? "bg-green-500 text-white"
                                : isCurrent
                                  ? "border-2 border-blue-400"
                                  : "border border-gray-300"
                            }`}
                          >
                            {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </div>
                          <span className="font-mono text-xs text-blue-600 w-20 truncate">
                            {item.sku}
                          </span>
                          <span className="text-gray-600 flex-1 truncate">
                            {item.variantName}
                          </span>
                          <span className="text-gray-500 w-8 text-center">
                            ×{item.quantityRequired}
                          </span>
                          <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            {item.locationName || "—"}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </StepCard>
          )}

          {/* ── STEP: Awaiting Pack ──────────────────────────────────────── */}
          {currentStep === "awaiting_pack" && (
            <StepCard
              title="All Items Picked"
              description="Ready for packing verification."
              icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
            >
              <button
                onClick={generatePackList}
                disabled={actionLoading}
                className="cursor-pointer w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2 transition"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <BoxIcon className="w-4 h-4" />
                )}
                Generate Pack List
              </button>
            </StepCard>
          )}

          {/* ── STEP: Packing ────────────────────────────────────────────── */}
          {currentStep === "packing" && packing && (
            <StepCard
              title={`Packing (${packing.completedItems}/${packing.totalItems})`}
              description="Scan each item to verify, then enter weight and dimensions."
              icon={<BoxIcon className="w-5 h-5 text-purple-500" />}
            >
              {/* Progress bar */}
              <div className="mb-4">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all duration-300"
                    style={{
                      width: `${packing.totalItems > 0 ? (packing.completedItems / packing.totalItems) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Pack items */}
              <div className="space-y-1 mb-4">
                {Object.values(scanLookup.pack)
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((item) => {
                    const isDone = item.status === "COMPLETED";
                    const isCurrent =
                      getCurrentPackItem()?.taskItemId === item.taskItemId;

                    return (
                      <div
                        key={item.taskItemId}
                        className={`flex items-center gap-3 p-3 rounded-lg text-sm ${
                          isCurrent
                            ? "bg-purple-50 border border-purple-200"
                            : isDone
                              ? "bg-gray-50 opacity-60"
                              : "bg-gray-50"
                        }`}
                      >
                        <button
                          onClick={() =>
                            !isDone && verifyPackItem(item.taskItemId)
                          }
                          disabled={isDone || actionLoading}
                          className={`cursor-pointer w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition ${
                            isDone
                              ? "bg-purple-500 text-white"
                              : "border-2 border-gray-300 hover:border-purple-400 cursor-pointer"
                          }`}
                        >
                          {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>
                        <span className="font-mono text-xs text-blue-600 w-20 truncate">
                          {item.sku}
                        </span>
                        <span className="text-gray-600 flex-1 truncate">
                          {item.variantName}
                        </span>
                        <span className="text-gray-500 w-8 text-center">
                          ×{item.quantityRequired}
                        </span>
                      </div>
                    );
                  })}
              </div>

              {/* Weight & Dimensions form — show when all items verified */}
              {packing.completedItems === packing.totalItems &&
                packing.totalItems > 0 && (
                  <div className="border-t pt-4 mt-4">
                    <div className="text-sm font-semibold text-gray-700 mb-3">
                      Package Details
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Weight
                        </label>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            step="0.1"
                            value={packWeight}
                            onChange={(e) => setPackWeight(e.target.value)}
                            placeholder="0.0"
                            className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                          />
                          <select
                            value={packWeightUnit}
                            onChange={(e) => setPackWeightUnit(e.target.value)}
                            className="px-2 py-2 border border-border rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                          >
                            <option value="ounce">oz</option>
                            <option value="pound">lb</option>
                            <option value="gram">g</option>
                            <option value="kilogram">kg</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {[
                        {
                          label: "Length",
                          val: packLength,
                          set: setPackLength,
                        },
                        { label: "Width", val: packWidth, set: setPackWidth },
                        {
                          label: "Height",
                          val: packHeight,
                          set: setPackHeight,
                        },
                      ].map(({ label, val, set }) => (
                        <div key={label}>
                          <label className="block text-xs text-gray-500 mb-1">
                            {label} (in)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={val}
                            onChange={(e) => set(e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={completePacking}
                      disabled={actionLoading}
                      className="cursor-pointer w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2 transition"
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Complete Packing
                    </button>
                  </div>
                )}
            </StepCard>
          )}

          {/* ── STEP: Awaiting Ship ──────────────────────────────────────── */}
          {currentStep === "awaiting_ship" && (
            <StepCard
              title="Ready to Ship"
              description="Select carrier, service, and create shipping label."
              icon={<Truck className="w-5 h-5 text-indigo-500" />}
            >
              <ShippingLabelForm
                order={{
                  id: order.id,
                  orderNumber: order.orderNumber,
                  customerName: order.customerName,
                  status: order.status,
                  lineItems: order.items.map((item) => ({
                    id: item.id,
                    sku: item.sku,
                    name: item.productVariant?.name || item.sku,
                    quantity: item.quantity,
                    quantityPicked: item.quantityPicked,
                    unitPrice: 0,
                  })),
                  shippingAddress: order.shippingAddress,
                }}
                onSuccess={(labels) => {
                  labels.forEach((label) => {
                    if (label.labelUrl) {
                      window.open(label.labelUrl, "_blank");
                    }
                  });
                  fetchStatus();
                }}
                embedded
                initialWeight={
                  packing?.packedWeight
                    ? Number(packing.packedWeight)
                    : undefined
                }
                initialDimensions={
                  packing?.packedDimensions
                    ? {
                        length: packing.packedDimensions.length,
                        width: packing.packedDimensions.width,
                        height: packing.packedDimensions.height,
                      }
                    : undefined
                }
              />
            </StepCard>
          )}

          {/* ── STEP: Shipped ────────────────────────────────────────────── */}
          {(currentStep === "shipped" || currentStep === "delivered") &&
            shipping && (
              <StepCard
                title="Shipped"
                description={`Shipped on ${new Date(shipping.createdAt).toLocaleDateString()}`}
                icon={<Truck className="w-5 h-5 text-cyan-500" />}
              >
                <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-5">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-lg font-bold uppercase">
                      {shipping.carrier}
                    </span>
                    <span className="text-xs font-semibold px-2 py-1 rounded bg-cyan-100 text-cyan-700">
                      {shipping.service}
                    </span>
                  </div>
                  <div className="text-lg font-mono font-semibold text-cyan-600 mb-3">
                    {shipping.trackingNumber}
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>
                      Rate:{" "}
                      <span className="font-semibold text-green-600">
                        $
                        {typeof shipping.rate === "number"
                          ? shipping.rate.toFixed(2)
                          : shipping.rate}
                      </span>
                    </span>
                    {shipping.labelUrl && (
                      <a
                        href={shipping.labelUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        View Label →
                      </a>
                    )}
                  </div>
                </div>
              </StepCard>
            )}
        </div>

        {/* ── Right: Event Timeline ──────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setShowTimeline(!showTimeline)}
              className="cursor-pointer w-full flex items-center justify-between px-4 py-3 border-b border-border text-sm font-medium text-gray-700 hover:bg-gray-50 transition lg:cursor-default"
            >
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                Events
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  {status.events.length}
                </span>
              </span>
              <span className="lg:hidden">
                {showTimeline ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </span>
            </button>

            <div
              className={`${showTimeline ? "block" : "hidden"} lg:block max-h-[600px] overflow-y-auto`}
            >
              {status.events.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">
                  No events yet
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {[...status.events].reverse().map((event) => (
                    <div key={event.id} className="px-4 py-2.5">
                      <div className="flex items-center justify-between">
                        <EventBadge type={event.type} />
                        <span className="text-[10px] text-gray-400 font-mono">
                          {new Date(event.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate">
                        {eventDescription(event)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function StepProgress({ currentStep }: { currentStep: string }) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="bg-white border border-border rounded-lg p-4">
      <div className="flex items-center justify-between">
        {STEPS.map((step, i) => {
          const isDone = i < currentIdx;
          const isCurrent = i === currentIdx;
          const Icon = step.icon;

          return (
            <div
              key={step.key}
              className="flex items-center flex-1 last:flex-none"
            >
              {/* Step dot */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                    isDone
                      ? "bg-green-100 text-green-600"
                      : isCurrent
                        ? "bg-blue-100 text-blue-600 ring-2 ring-blue-300"
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={`text-[10px] mt-1 font-medium ${
                    isDone
                      ? "text-green-600"
                      : isCurrent
                        ? "text-blue-600"
                        : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className="flex-1 mx-2">
                  <div
                    className={`h-0.5 rounded-full ${
                      isDone ? "bg-green-400" : "bg-gray-200"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-border rounded-lg p-5">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      {children}
    </div>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: "bg-gray-100 text-gray-700",
    CONFIRMED: "bg-gray-100 text-gray-700",
    ALLOCATED: "bg-blue-100 text-blue-700",
    PICKING: "bg-blue-100 text-blue-700",
    PICKED: "bg-green-100 text-green-700",
    PACKING: "bg-purple-100 text-purple-700",
    PACKED: "bg-indigo-100 text-indigo-700",
    SHIPPED: "bg-cyan-100 text-cyan-700",
    DELIVERED: "bg-green-100 text-green-700",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${colors[status] || "bg-gray-100 text-gray-700"}`}
    >
      {status}
    </span>
  );
}

function EventBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; color: string }> = {
    "order:processing": { label: "PROC", color: "bg-green-100 text-green-700" },
    "order:picked": { label: "PICKD", color: "bg-amber-100 text-amber-700" },
    "order:packed": { label: "PACKD", color: "bg-purple-100 text-purple-700" },
    "order:shipped": { label: "SHIP", color: "bg-cyan-100 text-cyan-700" },
    "picklist:generated": {
      label: "PLIST",
      color: "bg-amber-100 text-amber-700",
    },
    "picklist:item_picked": {
      label: "SCAN",
      color: "bg-yellow-100 text-yellow-700",
    },
    "picklist:completed": {
      label: "PICK✓",
      color: "bg-green-100 text-green-700",
    },
    "packing:started": {
      label: "PACK",
      color: "bg-purple-100 text-purple-700",
    },
    "packing:item_verified": {
      label: "VRFY",
      color: "bg-purple-100 text-purple-700",
    },
    "packing:completed": {
      label: "PACK✓",
      color: "bg-green-100 text-green-700",
    },
    "shipping:label_created": {
      label: "LABEL",
      color: "bg-cyan-100 text-cyan-700",
    },
    "inventory:updated": {
      label: "INV",
      color: "bg-orange-100 text-orange-700",
    },
  };

  const c = config[type] || {
    label: "EVT",
    color: "bg-gray-100 text-gray-600",
  };

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${c.color}`}
    >
      {c.label}
    </span>
  );
}

function eventDescription(event: { type: string; payload: any }): string {
  const p = event.payload;
  if (!p) return event.type;

  switch (event.type) {
    case "picklist:generated":
      return `Pick list generated — ${p.totalItems ?? p.itemCount ?? "?"} items`;
    case "picklist:item_picked":
      return `${p.sku}: ${p.quantity}x from ${p.location || "—"} (${p.progress || ""})`;
    case "picklist:completed":
      return p.message || "All items picked";
    case "packing:started":
      return `Packing started — ${p.itemCount || "?"} items`;
    case "packing:item_verified":
      return `${p.sku}: verified (${p.progress || ""})`;
    case "packing:completed":
      return `${p.weight || "?"}${p.weightUnit || "oz"} — ${p.dimensions ? `${p.dimensions.length}×${p.dimensions.width}×${p.dimensions.height}` : ""}`;
    case "shipping:label_created":
      return `${(p.carrier || "").toUpperCase()} ${p.service || ""} — ${p.trackingNumber || ""}`;
    case "order:processing":
    case "order:picked":
    case "order:packed":
    case "order:shipped":
      return p.message || p.orderNumber || "";
    case "inventory:updated":
      return `${p.sku}: ${p.previousQty}→${p.newQty}`;
    default:
      return p.message || event.type;
  }
}

export { FulfillmentDetailPage };
