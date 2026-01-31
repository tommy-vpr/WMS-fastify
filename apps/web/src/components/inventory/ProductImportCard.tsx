/**
 * Product Import Card
 * Upload CSV to import products - simple upload and result
 *
 * Save to: apps/web/src/components/products/ProductImportCard.tsx
 */

import { useState, useCallback, useEffect } from "react";
import {
  Upload,
  AlertCircle,
  CheckCircle,
  Loader2,
  Package,
  Download,
} from "lucide-react";
import { apiClient } from "@/lib/api";

interface JobStatus {
  jobId: string;
  state: string;
  progress: number;
  result?: {
    success: number;
    failed: number;
    errors: Array<{ sku: string; error: string }>;
  };
}

interface ParsedVariant {
  sku: string;
  upc: string;
  name: string;
  barcode?: string;
  weight?: number;
}

interface ParsedProduct {
  sku: string;
  name: string;
  brand?: string;
  category?: string;
  variants: ParsedVariant[];
}

export function ProductImportCard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);

  // ============================================================================
  // CSV Parsing
  // ============================================================================

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));

    return lines.slice(1).map((line) => {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;

      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const row: Record<string, string> = {};
      headers.forEach((h, i) => (row[h] = values[i]?.replace(/"/g, "") || ""));
      return row;
    });
  };

  const handleUpload = useCallback(async (file: File) => {
    setLoading(true);
    setError("");
    setJobStatus(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const rows = parseCSV(text);

        const required = ["SKU", "NAME"];
        const hasRequired = required.every((col) =>
          Object.keys(rows[0] || {}).some(
            (k) => k.toUpperCase() === col.toUpperCase(),
          ),
        );

        if (!hasRequired) {
          throw new Error(`CSV must have columns: ${required.join(", ")}`);
        }

        // Normalize and group
        const normalizedRows = rows.map((row) => {
          const normalized: Record<string, string> = {};
          Object.entries(row).forEach(([key, value]) => {
            normalized[key.toUpperCase()] = value;
          });
          return normalized;
        });

        const grouped: Record<string, ParsedProduct> = {};

        normalizedRows.forEach((row) => {
          if (!row.SKU) return;

          const productKey = row.BRAND
            ? `${row.BRAND}-${row.CATEGORY || "General"}`
            : row.NAME?.split(" ").slice(0, 2).join(" ") || row.SKU;

          if (!grouped[productKey]) {
            grouped[productKey] = {
              sku: productKey.toUpperCase().replace(/[^A-Z0-9]/g, "-"),
              name: productKey,
              brand: row.BRAND,
              category: row.CATEGORY,
              variants: [],
            };
          }

          grouped[productKey].variants.push({
            sku: row.SKU,
            upc: row.UPC || "",
            name: row.NAME || row.PRODUCT || row.SKU,
            barcode: row.UPC || row.BARCODE,
            weight: row.WEIGHT ? parseFloat(row.WEIGHT) : undefined,
          });
        });

        const products = Object.values(grouped);

        // Submit import job
        const data = await apiClient.post<{ success: boolean; jobId: string }>(
          "/products/import",
          {
            products: products.map((p) => ({
              product: {
                sku: p.sku,
                name: p.name,
                brand: p.brand,
                category: p.category,
              },
              variants: p.variants,
            })),
          },
        );

        setJobId(data.jobId);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };
    reader.readAsText(file);
  }, []);

  // ============================================================================
  // Job Status Polling
  // ============================================================================

  useEffect(() => {
    if (!jobId) return;

    const pollStatus = async () => {
      try {
        const data = await apiClient.get<JobStatus>(
          `/products/import/job/${jobId}`,
        );
        setJobStatus(data);

        if (data.state === "completed" || data.state === "failed") {
          setLoading(false);
          setJobId(null);
        }
      } catch (err) {
        console.error("Failed to fetch job status:", err);
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 2000);

    return () => clearInterval(interval);
  }, [jobId]);

  // ============================================================================
  // Helpers
  // ============================================================================

  const downloadTemplate = () => {
    const template = `SKU,NAME,UPC,BARCODE,WEIGHT,BRAND,CATEGORY
PROD-001,Product Name,123456789012,,0.5,Brand Name,Category`;
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "product-import-template.csv";
    a.click();
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="bg-white border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Package className="w-5 h-5" />
            Product Import
          </h3>
          <p className="text-sm text-gray-500">Import products from CSV</p>
        </div>
        <button
          onClick={downloadTemplate}
          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
        >
          <Download className="w-4 h-4" />
          Template
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Result */}
      {jobStatus?.state === "completed" && jobStatus.result && (
        <div
          className={`mb-4 p-4 rounded-lg border ${
            jobStatus.result.failed === 0
              ? "bg-green-50 border-green-200"
              : "bg-yellow-50 border-yellow-200"
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle
              className={`w-5 h-5 ${
                jobStatus.result.failed === 0
                  ? "text-green-600"
                  : "text-yellow-600"
              }`}
            />
            <span className="font-medium">Import Complete</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Products Created:</span>{" "}
              <span className="font-medium text-green-600">
                {jobStatus.result.success}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Failed:</span>{" "}
              <span className="font-medium text-red-600">
                {jobStatus.result.failed}
              </span>
            </div>
          </div>
          {jobStatus.result.errors && jobStatus.result.errors.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <div className="text-sm text-red-600 font-medium mb-1">
                Errors ({jobStatus.result.errors.length}):
              </div>
              <ul className="text-xs text-red-600 space-y-1 max-h-24 overflow-y-auto">
                {jobStatus.result.errors.slice(0, 10).map((err, i) => (
                  <li key={i}>
                    <strong>{err.sku}:</strong> {err.error}
                  </li>
                ))}
                {jobStatus.result.errors.length > 10 && (
                  <li className="text-gray-500">
                    +{jobStatus.result.errors.length - 10} more...
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          loading
            ? "border-gray-200 bg-gray-50"
            : "border-gray-300 hover:border-blue-400"
        }`}
        onDrop={(e) => {
          e.preventDefault();
          if (!loading && e.dataTransfer.files[0]) {
            handleUpload(e.dataTransfer.files[0]);
          }
        }}
        onDragOver={(e) => e.preventDefault()}
      >
        {loading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
            <span className="text-gray-600">
              {jobStatus
                ? `Importing... ${jobStatus.progress || 0}%`
                : "Processing..."}
            </span>
            {jobStatus && (
              <div className="w-full max-w-xs mt-2">
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${jobStatus.progress || 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 mb-2">
              Drop CSV file here or click to upload
            </p>
            <p className="text-xs text-gray-400 mb-3">
              Required: SKU, NAME • Optional: UPC, BRAND, CATEGORY, WEIGHT
            </p>
            <label className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded-lg cursor-pointer hover:bg-blue-700">
              Choose File
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) =>
                  e.target.files?.[0] && handleUpload(e.target.files[0])
                }
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
