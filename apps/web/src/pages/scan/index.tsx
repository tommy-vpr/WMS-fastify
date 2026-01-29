import { ScanBarcode } from "lucide-react";
import { useLayout } from "../../layouts";

// pages/scan/index.tsx
export function ScanPage() {
  const { compactMode } = useLayout();

  return (
    <div className={compactMode ? "p-4" : "p-6"}>
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-3">
        <ScanBarcode className="w-8 h-8 text-blue-500" />
        Scan
      </h1>

      <div className="bg-white border rounded-lg p-8 text-center">
        <div className="w-48 h-48 mx-auto border-4 border-dashed border-gray-300 rounded-lg flex items-center justify-center mb-4">
          <ScanBarcode className="w-16 h-16 text-gray-400" />
        </div>
        <p className="text-gray-600 mb-4">Scan a barcode or enter manually</p>
        <input
          type="text"
          placeholder="Enter SKU or UPC..."
          className="w-full max-w-sm px-4 py-3 border rounded-lg text-center text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          autoFocus
        />
      </div>
    </div>
  );
}
