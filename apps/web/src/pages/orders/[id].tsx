/**
 * Order Detail Page
 * View order details, line items, allocation status, and actions
 *
 * Save to: apps/web/src/pages/orders/[id].tsx
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  ShoppingCart,
  Package,
  Truck,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  MapPin,
  Mail,
  User,
  Calendar,
  RefreshCw,
  Play,
  Loader2,
  ClipboardList,
  PackageCheck,
  Ban,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { Loading } from "@/components/ui/loading";

// ============================================================================
// Types
// ============================================================================

interface OrderLineItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  quantityAllocated: number;
  quantityPicked: number;
  quantityShipped: number;
  unitPrice: number;
  productVariantId: string | null;
  allocationStatus: "ALLOCATED" | "PARTIAL" | "UNALLOCATED" | "BACKORDERED";
}

interface Order {
  id: string;
  orderNumber: string;
  externalId: string | null;
  source: string;
  status: OrderStatus;
  customerName: string | null;
  customerEmail: string | null;
  shippingName: string | null;
  shippingAddress1: string | null;
  shippingAddress2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingZip: string | null;
  shippingCountry: string | null;
  shippingPhone: string | null;
  notes: string | null;
  lineItems: OrderLineItem[];
  workTasks: WorkTask[];
  createdAt: string;
  updatedAt: string;
}

interface WorkTask {
  id: string;
  type: string;
  status: string;
  assignedTo: { name: string } | null;
  createdAt: string;
}

type OrderStatus =
  | "PENDING"
  | "ALLOCATED"
  | "PARTIALLY_ALLOCATED"
  | "PICKING"
  | "PICKED"
  | "PACKING"
  | "PACKED"
  | "SHIPPED"
  | "CANCELLED"
  | "ON_HOLD";

// ============================================================================
// Status Config
// ============================================================================

const statusConfig: Record<
  OrderStatus,
  { label: string; color: string; bgColor: string; icon: typeof Clock }
> = {
  PENDING: {
    label: "Pending",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
    icon: Clock,
  },
  ALLOCATED: {
    label: "Allocated",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    icon: Package,
  },
  PARTIALLY_ALLOCATED: {
    label: "Partially Allocated",
    color: "text-orange-700",
    bgColor: "bg-orange-100",
    icon: AlertCircle,
  },
  PICKING: {
    label: "Picking",
    color: "text-purple-700",
    bgColor: "bg-purple-100",
    icon: PackageCheck,
  },
  PICKED: {
    label: "Picked",
    color: "text-indigo-700",
    bgColor: "bg-indigo-100",
    icon: CheckCircle,
  },
  PACKING: {
    label: "Packing",
    color: "text-pink-700",
    bgColor: "bg-pink-100",
    icon: Package,
  },
  PACKED: {
    label: "Packed",
    color: "text-cyan-700",
    bgColor: "bg-cyan-100",
    icon: CheckCircle,
  },
  SHIPPED: {
    label: "Shipped",
    color: "text-green-700",
    bgColor: "bg-green-100",
    icon: Truck,
  },
  CANCELLED: {
    label: "Cancelled",
    color: "text-red-700",
    bgColor: "bg-red-100",
    icon: XCircle,
  },
  ON_HOLD: {
    label: "On Hold",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
    icon: AlertCircle,
  },
};

// ============================================================================
// Main Component
// ============================================================================

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const fetchOrder = async () => {
    if (!id) return;

    setLoading(true);
    setError("");

    try {
      const data = await apiClient.get<Order>(`/orders/${id}`);
      setOrder(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  // ============================================================================
  // Actions
  // ============================================================================

  const handleAllocate = async () => {
    if (!order) return;

    setActionLoading("allocate");
    setActionMessage(null);

    try {
      await apiClient.post(`/orders/${order.id}/allocate`);
      setActionMessage({
        type: "success",
        text: "Inventory allocated successfully",
      });
      fetchOrder();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreatePickTask = async () => {
    if (!order) return;

    setActionLoading("pick");
    setActionMessage(null);

    try {
      await apiClient.post(`/orders/${order.id}/tasks/pick`);
      setActionMessage({
        type: "success",
        text: "Pick task created successfully",
      });
      fetchOrder();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!order) return;

    if (!confirm("Are you sure you want to cancel this order?")) return;

    setActionLoading("cancel");
    setActionMessage(null);

    try {
      await apiClient.post(`/orders/${order.id}/cancel`);
      setActionMessage({ type: "success", text: "Order cancelled" });
      fetchOrder();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleHold = async () => {
    if (!order) return;

    setActionLoading("hold");
    setActionMessage(null);

    try {
      await apiClient.post(`/orders/${order.id}/hold`);
      setActionMessage({ type: "success", text: "Order placed on hold" });
      fetchOrder();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
        <Link
          to="/orders"
          className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Orders
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">Order not found</p>
        </div>
      </div>
    );
  }

  const status = statusConfig[order.status] || statusConfig.PENDING;
  const StatusIcon = status.icon;

  const totalItems = order.lineItems.reduce((sum, li) => sum + li.quantity, 0);
  const allocatedItems = order.lineItems.reduce(
    (sum, li) => sum + li.quantityAllocated,
    0,
  );
  const pickedItems = order.lineItems.reduce(
    (sum, li) => sum + li.quantityPicked,
    0,
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/orders"
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Back to Orders"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Order {order.orderNumber}</h1>
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${status.bgColor} ${status.color}`}
              >
                <StatusIcon className="w-4 h-4" />
                {status.label}
              </span>
            </div>
            <p className="text-gray-500 text-sm">
              Created {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchOrder}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Action Message */}
      {actionMessage && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
            actionMessage.type === "success"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {actionMessage.type === "success" ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {actionMessage.text}
        </div>
      )}

      {/* Actions */}
      {!["SHIPPED", "CANCELLED"].includes(order.status) && (
        <div className="bg-white border border-border rounded-lg p-4 mb-6">
          <h2 className="font-semibold mb-3">Actions</h2>
          <div className="flex flex-wrap gap-2">
            {order.status === "PENDING" && (
              <button
                onClick={handleAllocate}
                disabled={!!actionLoading}
                className="cursor-pointer transition inline-flex items-center gap-2 px-4 py-2 
                bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading === "allocate" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Package className="w-4 h-4" />
                )}
                Allocate Inventory
              </button>
            )}

            {["ALLOCATED", "PARTIALLY_ALLOCATED"].includes(order.status) && (
              <button
                onClick={handleCreatePickTask}
                disabled={!!actionLoading}
                className="cursor-pointer transition inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {actionLoading === "pick" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ClipboardList className="w-4 h-4" />
                )}
                Create Pick Task
              </button>
            )}

            {order.status !== "ON_HOLD" && (
              <button
                onClick={handleHold}
                disabled={!!actionLoading}
                className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {actionLoading === "hold" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                Put On Hold
              </button>
            )}

            <button
              onClick={handleCancel}
              disabled={!!actionLoading}
              className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              {actionLoading === "cancel" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Ban className="w-4 h-4" />
              )}
              Cancel Order
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progress */}
          <div className="bg-white border border-border rounded-lg p-4">
            <h2 className="font-semibold mb-4">Fulfillment Progress</h2>
            <div className="grid grid-cols-3 gap-4">
              <ProgressCard
                label="Allocated"
                current={allocatedItems}
                total={totalItems}
                color="blue"
              />
              <ProgressCard
                label="Picked"
                current={pickedItems}
                total={totalItems}
                color="purple"
              />
              <ProgressCard
                label="Shipped"
                current={order.lineItems.reduce(
                  (sum, li) => sum + li.quantityShipped,
                  0,
                )}
                total={totalItems}
                color="green"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="font-semibold">
                Line Items ({order.lineItems.length})
              </h2>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-500">
                    Product
                  </th>
                  <th className="text-center px-4 py-2 text-sm font-medium text-gray-500">
                    Qty
                  </th>
                  <th className="text-center px-4 py-2 text-sm font-medium text-gray-500">
                    Allocated
                  </th>
                  <th className="text-center px-4 py-2 text-sm font-medium text-gray-500">
                    Picked
                  </th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {order.lineItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 border-border">
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-gray-500">{item.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-center">{item.quantity}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={
                          item.quantityAllocated >= item.quantity
                            ? "text-green-600"
                            : item.quantityAllocated > 0
                              ? "text-yellow-600"
                              : "text-gray-400"
                        }
                      >
                        {item.quantityAllocated}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={
                          item.quantityPicked >= item.quantity
                            ? "text-green-600"
                            : item.quantityPicked > 0
                              ? "text-yellow-600"
                              : "text-gray-400"
                        }
                      >
                        {item.quantityPicked}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <AllocationBadge status={item.allocationStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Work Tasks */}
          {order.workTasks && order.workTasks.length > 0 && (
            <div className="bg-white border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b">
                <h2 className="font-semibold">Work Tasks</h2>
              </div>
              <div className="divide-y">
                {order.workTasks.map((task) => (
                  <div
                    key={task.id}
                    className="px-4 py-3 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">{task.type}</div>
                      <div className="text-sm text-gray-500">
                        {task.assignedTo?.name || "Unassigned"} •{" "}
                        {new Date(task.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        task.status === "COMPLETED"
                          ? "bg-green-100 text-green-700"
                          : task.status === "IN_PROGRESS"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {task.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Info */}
          <div className="bg-white border border-border rounded-lg p-4">
            <h2 className="font-semibold mb-3">Order Info</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-gray-500">Created</div>
                  <div>{new Date(order.createdAt).toLocaleString()}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Package className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-gray-500">Source</div>
                  <div>{order.source}</div>
                </div>
              </div>
              {order.externalId && (
                <div className="flex items-start gap-3">
                  <ShoppingCart className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-gray-500">External ID</div>
                    <div className="font-mono text-xs">{order.externalId}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Customer */}
          <div className="bg-white border border-border rounded-lg p-4">
            <h2 className="font-semibold mb-3">Customer</h2>
            <div className="space-y-3 text-sm">
              {order.customerName && (
                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>{order.customerName}</div>
                </div>
              )}
              {order.customerEmail && (
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>{order.customerEmail}</div>
                </div>
              )}
            </div>
          </div>

          {/* Shipping Address */}
          {order.shippingAddress1 && (
            <div className="bg-white border border-border rounded-lg p-4">
              <h2 className="font-semibold mb-3">Shipping Address</h2>
              <div className="flex items-start gap-3 text-sm">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  {order.shippingName && <div>{order.shippingName}</div>}
                  <div>{order.shippingAddress1}</div>
                  {order.shippingAddress2 && (
                    <div>{order.shippingAddress2}</div>
                  )}
                  <div>
                    {order.shippingCity}, {order.shippingState}{" "}
                    {order.shippingZip}
                  </div>
                  {order.shippingCountry && <div>{order.shippingCountry}</div>}
                  {order.shippingPhone && (
                    <div className="mt-2 text-gray-500">
                      {order.shippingPhone}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div className="bg-white border rounded-lg p-4">
              <h2 className="font-semibold mb-3">Notes</h2>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {order.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function ProgressCard({
  label,
  current,
  total,
  color,
}: {
  label: string;
  current: number;
  total: number;
  color: string;
}) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  const colors: Record<string, { bar: string; text: string }> = {
    blue: { bar: "bg-blue-500", text: "text-blue-600" },
    purple: { bar: "bg-purple-500", text: "text-purple-600" },
    green: { bar: "bg-green-500", text: "text-green-600" },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-500">{label}</span>
        <span className={`text-sm font-medium ${colors[color].text}`}>
          {current}/{total}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${colors[color].bar} transition-all`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function AllocationBadge({
  status,
}: {
  status: "ALLOCATED" | "PARTIAL" | "UNALLOCATED" | "BACKORDERED";
}) {
  const config: Record<string, { label: string; color: string }> = {
    ALLOCATED: { label: "Allocated", color: "bg-green-100 text-green-700" },
    PARTIAL: { label: "Partial", color: "bg-yellow-100 text-yellow-700" },
    UNALLOCATED: { label: "Unallocated", color: "bg-gray-100 text-gray-700" },
    BACKORDERED: { label: "Backordered", color: "bg-red-100 text-red-700" },
  };

  const c = config[status] || config.UNALLOCATED;

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.color}`}>
      {c.label}
    </span>
  );
}
