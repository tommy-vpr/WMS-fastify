/**
 * Shipping Label Form Component
 * Adapted for WMS with service/queue pattern
 *
 * Save to: apps/web/src/components/shipping/ShippingLabelForm.tsx
 *
 * Uses:
 * - GET /api/shipping/carriers - Load carriers and presets
 * - POST /api/shipping/create-label - Create label synchronously
 * - POST /api/shipping/create-label-async - Queue label creation (background)
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Plus,
  Minus,
  Package,
  Truck,
  AlertCircle,
  Loader2,
  X,
  Zap,
  ExternalLink,
} from "lucide-react";
import { apiClient } from "@/lib/api";

// ============================================================================
// Types
// ============================================================================

interface ShippingPreset {
  id: string;
  label: string;
  carrier: "ups" | "usps";
  serviceCode: string;
  serviceName: string;
  packageType: string;
  confirmation: string;
  boxId?: string;
  dimensions?: { length: number; width: number; height: number };
  isFlatRate?: boolean;
  usedBy: string[];
  purpose?: string;
}

interface BoxDefinition {
  id: string;
  label: string;
  dimensions: { length: number; width: number; height: number };
  usedBy: string[];
  purpose?: string;
  isFlatRate?: boolean;
}

interface PackageConfig {
  id: string;
  packageCode: string;
  weight: string;
  dimensions: { length: string; width: string; height: string };
  items: ShipmentItem[];
  presetId?: string;
}

interface Shipment {
  id: string;
  name: string;
  items: ShipmentItem[];
  carrierId: string;
  serviceCode: string;
  packages: PackageConfig[];
  notes: string;
  presetId?: string;
}

interface OrderItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  quantityPicked?: number;
  unitPrice?: number;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  status: string;
  totalAmount?: number;
  lineItems: OrderItem[];
  shippingAddress: {
    address1: string;
    city: string;
    province?: string;
    province_code?: string;
    zip: string;
    name?: string;
    country?: string;
    country_code?: string;
  };
}

interface Carrier {
  carrier_id: string;
  carrier_code: string;
  friendly_name: string;
  services: Array<{ service_code: string; name: string }>;
  packages: Array<{ package_code: string; name: string }>;
}

interface ShipmentItem {
  itemId: string;
  productName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
}

interface LabelResult {
  trackingNumber: string;
  labelUrl: string;
  cost: number;
  trackingUrl?: string;
}

interface ShippingLabelFormProps {
  order: Order;
  onSuccess?: (results: LabelResult[]) => void;
  onCancel?: () => void;
  embedded?: boolean;
  initialWeight?: number;
  initialDimensions?: { length: number; width: number; height: number };
}

// ============================================================================
// Component
// ============================================================================

export default function ShippingLabelForm({
  order,
  onSuccess,
  onCancel,
  embedded = false,
  initialWeight,
  initialDimensions,
}: ShippingLabelFormProps) {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [presets, setPresets] = useState<ShippingPreset[]>([]);
  const [boxes, setBoxes] = useState<BoxDefinition[]>([]);
  const [quickAccessPresets, setQuickAccessPresets] = useState<
    ShippingPreset[]
  >([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [carriersLoading, setCarriersLoading] = useState(true);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [showPresetSelector, setShowPresetSelector] = useState(false);
  const [numberOfPackages, setNumberOfPackages] = useState("");

  const dimensionsAppliedRef = useRef(false);

  const generateId = useCallback(
    () => Date.now().toString(36) + Math.random().toString(36).substr(2),
    [],
  );

  // ============================================================================
  // Initialization
  // ============================================================================

  useEffect(() => {
    loadCarriersAndPresets();
    initializeShipment();
  }, []);

  useEffect(() => {
    if (
      (initialDimensions || initialWeight) &&
      shipments.length > 0 &&
      !dimensionsAppliedRef.current
    ) {
      setShipments((prev) => {
        const updated = [...prev];
        const first = updated[0];
        if (first && first.packages.length > 0) {
          updated[0] = {
            ...first,
            packages: [
              {
                ...first.packages[0],
                weight: initialWeight?.toString() || first.packages[0].weight,
                dimensions: {
                  length:
                    initialDimensions?.length?.toString() ||
                    first.packages[0].dimensions.length,
                  width:
                    initialDimensions?.width?.toString() ||
                    first.packages[0].dimensions.width,
                  height:
                    initialDimensions?.height?.toString() ||
                    first.packages[0].dimensions.height,
                },
              },
              ...first.packages.slice(1),
            ],
          };
        }
        return updated;
      });
      dimensionsAppliedRef.current = true;
    }
  }, [initialWeight, initialDimensions, shipments.length]);

  const initializeShipment = () => {
    const initialShipment: Shipment = {
      id: generateId(),
      name: "Shipment 1",
      items: order.lineItems.map((item) => ({
        itemId: item.id,
        productName: item.name,
        sku: item.sku,
        unitPrice: item.unitPrice || 0,
        quantity: item.quantityPicked ?? item.quantity,
      })),
      carrierId: "",
      serviceCode: "",
      packages: [
        {
          id: generateId(),
          packageCode: "",
          weight: initialWeight?.toString() || "",
          dimensions: {
            length: initialDimensions?.length?.toString() || "12",
            width: initialDimensions?.width?.toString() || "10",
            height: initialDimensions?.height?.toString() || "6",
          },
          items: [],
        },
      ],
      notes: "",
    };
    setShipments([initialShipment]);
    dimensionsAppliedRef.current = false;
  };

  const loadCarriersAndPresets = async () => {
    try {
      setCarriersLoading(true);
      const data = await apiClient.get<{
        carriers: Carrier[];
        presets: ShippingPreset[];
        boxes: BoxDefinition[];
        quickAccess: ShippingPreset[];
      }>("/shipping/carriers");

      setCarriers(data.carriers || []);
      setPresets(data.presets || []);
      setBoxes(data.boxes || []);
      setQuickAccessPresets(data.quickAccess || []);
    } catch (err) {
      console.error("Failed to load shipping data:", err);
      setError("Failed to load shipping options");
    } finally {
      setCarriersLoading(false);
    }
  };

  // ============================================================================
  // Preset Helpers
  // ============================================================================

  const applyPreset = useCallback(
    (shipmentId: string, preset: ShippingPreset) => {
      const carrierCodeMap: Record<string, string> = {
        usps: "stamps_com",
        ups: "ups",
      };
      const targetCarrierCode = carrierCodeMap[preset.carrier];
      const carrier = carriers.find(
        (c) => c.carrier_code === targetCarrierCode,
      );

      if (!carrier) return;

      setShipments((prev) =>
        prev.map((shipment) => {
          if (shipment.id !== shipmentId) return shipment;
          return {
            ...shipment,
            carrierId: carrier.carrier_id,
            serviceCode: preset.serviceCode,
            presetId: preset.id,
            packages: [
              {
                ...shipment.packages[0],
                packageCode: preset.packageType,
                presetId: preset.id,
                dimensions: preset.dimensions
                  ? {
                      length: preset.dimensions.length.toString(),
                      width: preset.dimensions.width.toString(),
                      height: preset.dimensions.height.toString(),
                    }
                  : shipment.packages[0].dimensions,
              },
              ...shipment.packages.slice(1),
            ],
          };
        }),
      );
      setShowPresetSelector(false);
    },
    [carriers],
  );

  const getPresetsForCarrier = (carrierId: string): ShippingPreset[] => {
    const carrier = carriers.find((c) => c.carrier_id === carrierId);
    if (!carrier) return [];

    const carrierCode = carrier.carrier_code.toLowerCase();
    let presetCarrierType: "ups" | "usps" | null = null;

    if (carrierCode === "ups") presetCarrierType = "ups";
    else if (carrierCode === "stamps_com") presetCarrierType = "usps";

    if (!presetCarrierType) return [];
    return presets.filter((p) => p.carrier === presetCarrierType);
  };

  const getCarrierOptions = (carrierId: string) => {
    const carrier = carriers.find((c) => c.carrier_id === carrierId);

    // Dedupe services by service_code
    const uniqueServices = (carrier?.services || []).filter(
      (service, index, self) =>
        index ===
        self.findIndex((s) => s.service_code === service.service_code),
    );

    // Dedupe packages by package_code
    const uniquePackages = (carrier?.packages || []).filter(
      (pkg, index, self) =>
        index === self.findIndex((p) => p.package_code === pkg.package_code),
    );

    return {
      services: uniqueServices,
      packages: uniquePackages,
    };
  };

  // ============================================================================
  // Package Management
  // ============================================================================

  const updateShippingConfig = useCallback(
    (shipmentId: string, field: string, value: string) => {
      setShipments((prev) =>
        prev.map((s) => (s.id === shipmentId ? { ...s, [field]: value } : s)),
      );
    },
    [],
  );

  const updatePackageConfig = useCallback(
    (shipmentId: string, packageId: string, field: string, value: string) => {
      setShipments((prev) =>
        prev.map((shipment) => {
          if (shipment.id !== shipmentId) return shipment;
          return {
            ...shipment,
            packages: shipment.packages.map((pkg) =>
              pkg.id === packageId
                ? field.includes(".")
                  ? {
                      ...pkg,
                      dimensions: {
                        ...pkg.dimensions,
                        [field.split(".")[1]]: value,
                      },
                    }
                  : { ...pkg, [field]: value }
                : pkg,
            ),
          };
        }),
      );
    },
    [],
  );

  const addPackageToShipment = (shipmentId: string) => {
    setShipments((prev) =>
      prev.map((s) => {
        if (s.id !== shipmentId) return s;
        const first = s.packages[0];
        return {
          ...s,
          packages: [
            ...s.packages,
            {
              id: generateId(),
              packageCode: first?.packageCode || "",
              weight: "",
              dimensions: { length: "12", width: "10", height: "6" },
              items: [],
            },
          ],
        };
      }),
    );
  };

  const removePackageFromShipment = (shipmentId: string, packageId: string) => {
    setShipments((prev) =>
      prev.map((s) =>
        s.id === shipmentId
          ? { ...s, packages: s.packages.filter((p) => p.id !== packageId) }
          : s,
      ),
    );
  };

  const addMultiplePackagesWithWeightDistribution = (
    shipmentId: string,
    count: number,
  ) => {
    const shipment = shipments.find((s) => s.id === shipmentId);
    if (!shipment) return;

    const first = shipment.packages[0];
    const newPackages: PackageConfig[] = Array.from({ length: count }, () => ({
      id: generateId(),
      packageCode: first?.packageCode || "",
      weight: "",
      dimensions: first?.dimensions
        ? { ...first.dimensions }
        : { length: "12", width: "10", height: "6" },
      items: [],
    }));

    setShipments((prev) =>
      prev.map((s) =>
        s.id === shipmentId ? { ...s, packages: newPackages } : s,
      ),
    );
    setNumberOfPackages("");
  };

  // ============================================================================
  // Validation & Submission
  // ============================================================================

  const validateShipments = (): string[] => {
    const errors: string[] = [];
    shipments.forEach((shipment) => {
      if (shipment.items.length === 0) {
        errors.push(`${shipment.name} must have at least one item`);
      }
      if (!shipment.carrierId || !shipment.serviceCode) {
        errors.push(`${shipment.name} needs carrier and service selected`);
      }
      if (shipment.packages.length === 0) {
        errors.push(`${shipment.name} must have at least one package`);
      } else {
        shipment.packages.forEach((pkg, i) => {
          if (!pkg.packageCode) {
            errors.push(
              `${shipment.name} package ${i + 1} needs a package type`,
            );
          }
          if (!pkg.weight || parseFloat(pkg.weight) <= 0) {
            errors.push(
              `${shipment.name} package ${i + 1} needs a valid weight`,
            );
          }
        });
      }
    });
    return errors;
  };

  const processShipments = async () => {
    const validationErrors = validateShipments();
    if (validationErrors.length > 0) {
      setError(validationErrors.join("; "));
      return;
    }

    setProcessing(true);
    setError("");

    try {
      const results: LabelResult[] = [];
      const shipment = shipments[0];
      const carrier = carriers.find((c) => c.carrier_id === shipment.carrierId);

      if (!carrier) throw new Error("Carrier not found");

      const shipmentData = {
        orderId: order.id,
        carrierCode: carrier.carrier_code,
        serviceCode: shipment.serviceCode,
        packages: shipment.packages.map((pkg, idx) => ({
          packageCode: pkg.packageCode,
          weight: parseFloat(pkg.weight),
          length: parseFloat(pkg.dimensions.length),
          width: parseFloat(pkg.dimensions.width),
          height: parseFloat(pkg.dimensions.height),
          items: shipment.items.map((item) => ({
            productName: item.productName,
            sku: item.sku,
            quantity: Math.ceil(item.quantity / shipment.packages.length),
            unitPrice: item.unitPrice,
          })),
        })),
        shippingAddress: {
          name: order.shippingAddress.name || order.customerName,
          address1: order.shippingAddress.address1,
          city: order.shippingAddress.city,
          zip: order.shippingAddress.zip,
          province: order.shippingAddress.province,
          province_code: order.shippingAddress.province_code,
          country_code: order.shippingAddress.country_code || "US",
        },
        items: shipment.items.map((item) => ({
          productName: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        notes: shipment.notes,
      };

      const response = await apiClient.post<{
        success: boolean;
        labels: LabelResult[];
        label: LabelResult;
      }>("/shipping/create-label", shipmentData);

      if (response.labels && response.labels.length > 0) {
        results.push(...response.labels);
      } else if (response.label) {
        results.push(response.label);
      }

      if (onSuccess) {
        onSuccess(results);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setProcessing(false);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className={embedded ? "" : "p-4"}>
      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-red-800">{error}</span>
        </div>
      )}

      <div className="space-y-4">
        {/* Quick Access Presets */}
        {shipments.length === 1 &&
          !shipments[0].carrierId &&
          quickAccessPresets.length > 0 && (
            <div className="border border-blue-100 rounded-lg p-4 bg-gray-100 border-border">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                Quick Start Presets
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {quickAccessPresets.slice(0, 4).map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(shipments[0].id, preset)}
                    className="text-left p-3 border border-border rounded-lg bg-white hover:border-blue-500 hover:shadow-md transition-all"
                  >
                    <div className="font-medium text-sm">{preset.label}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {preset.serviceName}
                      {preset.isFlatRate && (
                        <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                          Flat Rate
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowPresetSelector(true)}
                className="mt-3 text-sm text-blue-600 hover:underline"
              >
                View all presets →
              </button>
            </div>
          )}

        {/* Shipment Configuration */}
        {shipments.map((shipment) => (
          <div key={shipment.id} className="space-y-4">
            {/* Carrier & Service */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-2">
                  Carrier
                </label>
                <select
                  value={shipment.carrierId}
                  onChange={(e) => {
                    updateShippingConfig(
                      shipment.id,
                      "carrierId",
                      e.target.value,
                    );
                    updateShippingConfig(shipment.id, "serviceCode", "");
                  }}
                  disabled={carriersLoading}
                  className="w-full px-3 py-2 border border-border rounded text-sm"
                >
                  <option value="">
                    {carriersLoading ? "Loading..." : "Select Carrier"}
                  </option>
                  {carriers.map((c) => (
                    <option key={c.carrier_id} value={c.carrier_id}>
                      {c.friendly_name}
                    </option>
                  ))}
                </select>
              </div>

              {shipment.carrierId && (
                <div>
                  <label className="text-sm font-medium block mb-2">
                    Service
                  </label>
                  <select
                    value={shipment.serviceCode}
                    onChange={(e) =>
                      updateShippingConfig(
                        shipment.id,
                        "serviceCode",
                        e.target.value,
                      )
                    }
                    className="w-full px-3 py-2 border border-border rounded text-sm"
                  >
                    <option value="">Select Service</option>
                    {getCarrierOptions(shipment.carrierId).services.map((s) => (
                      <option key={s.service_code} value={s.service_code}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Presets for Carrier */}
            {shipment.carrierId &&
              getPresetsForCarrier(shipment.carrierId).length > 0 && (
                <div className="border border-border rounded-lg p-3 bg-blue-50">
                  <h4 className="text-sm font-medium mb-2">
                    Available Presets
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {getPresetsForCarrier(shipment.carrierId).map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => applyPreset(shipment.id, preset)}
                        className="text-left p-2 border rounded bg-white hover:border-blue-500 transition-colors text-xs"
                      >
                        <div className="font-medium">{preset.label}</div>
                        {preset.purpose && (
                          <div className="text-gray-600 mt-1">
                            {preset.purpose}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            {/* Package Details */}
            {shipment.carrierId && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium">Package Details</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={numberOfPackages}
                      onChange={(e) => setNumberOfPackages(e.target.value)}
                      placeholder="# pkgs"
                      className="w-20 px-2 py-1 text-sm border border-border rounded"
                    />
                    <button
                      onClick={() => {
                        const count = parseInt(numberOfPackages);
                        if (count > 0 && count <= 20) {
                          addMultiplePackagesWithWeightDistribution(
                            shipment.id,
                            count,
                          );
                        }
                      }}
                      disabled={
                        !numberOfPackages || parseInt(numberOfPackages) <= 0
                      }
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      Set
                    </button>
                    {shipment.packages.length < 20 && (
                      <button
                        onClick={() => addPackageToShipment(shipment.id)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add
                      </button>
                    )}
                  </div>
                </div>

                {/* Package List */}
                <div className="space-y-3">
                  {shipment.packages.map((pkg, idx) => (
                    <div
                      key={pkg.id}
                      className="border border-border p-4 rounded bg-gray-50 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-emerald-600">
                          Package {idx + 1}
                        </span>
                        {shipment.packages.length > 1 && (
                          <button
                            onClick={() =>
                              removePackageFromShipment(shipment.id, pkg.id)
                            }
                            className="text-red-600 hover:text-red-800 p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium block mb-1">
                            Package Type
                          </label>
                          <select
                            value={pkg.packageCode}
                            onChange={(e) =>
                              updatePackageConfig(
                                shipment.id,
                                pkg.id,
                                "packageCode",
                                e.target.value,
                              )
                            }
                            className="w-full px-3 py-2 border border-border rounded text-sm"
                          >
                            <option value="">Select Type</option>
                            {getCarrierOptions(shipment.carrierId).packages.map(
                              (opt) => (
                                <option
                                  key={opt.package_code}
                                  value={opt.package_code}
                                >
                                  {opt.name}
                                </option>
                              ),
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-medium block mb-1">
                            Weight (lbs)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="0.0"
                            value={pkg.weight}
                            onChange={(e) =>
                              updatePackageConfig(
                                shipment.id,
                                pkg.id,
                                "weight",
                                e.target.value,
                              )
                            }
                            className="w-full px-3 py-2 border border-border rounded text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium block mb-1">
                          Dimensions (in)
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="number"
                            placeholder="L"
                            value={pkg.dimensions.length}
                            onChange={(e) =>
                              updatePackageConfig(
                                shipment.id,
                                pkg.id,
                                "dimensions.length",
                                e.target.value,
                              )
                            }
                            className="px-3 py-2 border border-border rounded text-sm"
                          />
                          <input
                            type="number"
                            placeholder="W"
                            value={pkg.dimensions.width}
                            onChange={(e) =>
                              updatePackageConfig(
                                shipment.id,
                                pkg.id,
                                "dimensions.width",
                                e.target.value,
                              )
                            }
                            className="px-3 py-2 border border-border rounded text-sm"
                          />
                          <input
                            type="number"
                            placeholder="H"
                            value={pkg.dimensions.height}
                            onChange={(e) =>
                              updatePackageConfig(
                                shipment.id,
                                pkg.id,
                                "dimensions.height",
                                e.target.value,
                              )
                            }
                            className="px-3 py-2 border border-border rounded text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Items Summary */}
            {shipment.items.length > 0 && (
              <div className="border border-border rounded-lg p-3 bg-gray-50">
                <h4 className="text-sm font-medium mb-2">Items to Ship</h4>
                <div className="space-y-1">
                  {shipment.items.map((item) => (
                    <div
                      key={item.itemId}
                      className="flex justify-between text-sm"
                    >
                      <span className="text-gray-700">{item.sku}</span>
                      <span className="font-medium">× {item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end pt-4 border-t border-border">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-6 py-2 border rounded hover:bg-gray-50"
              disabled={processing}
            >
              Cancel
            </button>
          )}
          <button
            onClick={processShipments}
            disabled={
              processing || shipments.every((s) => s.items.length === 0)
            }
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center"
          >
            {processing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Creating Labels...
              </>
            ) : (
              <>
                <Truck className="w-5 h-5 mr-2" />
                Create Label
                {shipments[0]?.packages.length > 1
                  ? `s (${shipments[0].packages.length})`
                  : ""}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Preset Selector Modal */}
      {showPresetSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Select Shipping Preset</h3>
              <button
                onClick={() => setShowPresetSelector(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(shipments[0].id, preset)}
                  className="text-left p-4 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
                >
                  <div className="font-medium text-sm mb-1">{preset.label}</div>
                  <div className="text-xs text-gray-600 mb-2">
                    {preset.serviceName}
                  </div>
                  {preset.dimensions && (
                    <div className="text-xs text-gray-500">
                      {preset.dimensions.length}" × {preset.dimensions.width}" ×{" "}
                      {preset.dimensions.height}"
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    {preset.isFlatRate && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                        Flat Rate
                      </span>
                    )}
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs uppercase">
                      {preset.carrier}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
