/**
 * Product CSV Import Parser
 *
 * Parses the WH1 location-product CSV format into UpsertProductData + UpsertVariantData
 * ready for productRepository.upsertWithVariants().
 *
 * CSV columns:
 *   PRODUCT, UPC, SKU, NAME, CATEGORY, VOLUME, STRENGTH,
 *   MC WEIGHT, MC QTY, MC DIMENSION, SINGLE DIMENSION, SINGLE WEIGHT
 *
 * Save to: packages/domain/src/services/product-csv-parser.ts
 *         (or wherever your import logic lives)
 */

import type { UpsertProductData, UpsertVariantData } from "@wms/db";

// ============================================================================
// Types
// ============================================================================

export interface ParsedWeight {
  value: number;
  unit: string; // "oz", "lbs", "g", "kg"
}

export interface ParsedDimensions {
  length: number;
  width: number;
  height: number;
  unit: string; // "in", "cm"
}

export interface CsvRow {
  PRODUCT: string;
  UPC: string;
  SKU: string;
  NAME: string;
  CATEGORY: string;
  VOLUME: string;
  STRENGTH: string;
  "MC WEIGHT": string;
  "MC QTY": string;
  "MC DIMENSION": string;
  "SINGLE DIMENSION": string;
  "SINGLE WEIGHT": string;
}

export interface ProductImportGroup {
  product: UpsertProductData;
  variants: UpsertVariantData[];
}

export interface ParseResult {
  groups: ProductImportGroup[];
  errors: string[];
  skipped: number;
}

// ============================================================================
// Parsers
// ============================================================================

/**
 * Parse weight string like "35 lbs", "5.59oz", "12 lbs"
 */
export function parseWeight(raw: string | undefined): ParsedWeight | null {
  if (!raw || !raw.trim()) return null;

  const match = raw.trim().match(/^([\d.]+)\s*(oz|lbs?|g|kg)$/i);
  if (!match) return null;

  let unit = match[2].toLowerCase();
  // Normalize "lb" → "lbs"
  if (unit === "lb") unit = "lbs";

  return {
    value: parseFloat(match[1]),
    unit,
  };
}

/**
 * Parse dimension string like "17 in x17 in x 5 in", "1.6 in x 4.7 in x 1.6 in"
 * Handles inconsistent spacing around "x"
 */
export function parseDimensions(
  raw: string | undefined,
): ParsedDimensions | null {
  if (!raw || !raw.trim()) return null;

  // Match patterns: "17 in x17 in x 5 in" or "1.6 in x 4.7 in x 1.6 in"
  const match = raw
    .trim()
    .match(/([\d.]+)\s*(\w+)\s*x\s*([\d.]+)\s*\w*\s*x\s*([\d.]+)\s*(\w+)/i);

  if (!match) return null;

  return {
    length: parseFloat(match[1]),
    width: parseFloat(match[3]),
    height: parseFloat(match[4]),
    unit: match[5].toLowerCase(),
  };
}

/**
 * Parse MC QTY string like "100"
 */
export function parseMcQuantity(raw: string | undefined): number | undefined {
  if (!raw || !raw.trim()) return undefined;
  const parsed = parseInt(raw.trim(), 10);
  return isNaN(parsed) ? undefined : parsed;
}

// ============================================================================
// Row → Variant
// ============================================================================

/**
 * Convert a single CSV row into variant data
 */
export function rowToVariantData(row: CsvRow): UpsertVariantData {
  const singleWeight = parseWeight(row["SINGLE WEIGHT"]);
  const singleDims = parseDimensions(row["SINGLE DIMENSION"]);
  const mcWeight = parseWeight(row["MC WEIGHT"]);
  const mcDims = parseDimensions(row["MC DIMENSION"]);
  const mcQty = parseMcQuantity(row["MC QTY"]);

  // Build variant name from available fields: "Banana 100ml 00mg"
  const parts = [row.NAME, row.VOLUME, row.STRENGTH].filter(Boolean);
  const variantName = parts.join(" ") || row.PRODUCT || row.SKU;

  return {
    sku: row.SKU.trim(),
    upc: row.UPC?.trim() || undefined,
    barcode: row.UPC?.trim() || undefined,
    name: variantName,

    // Single unit
    weight: singleWeight?.value,
    weightUnit: singleWeight?.unit,
    length: singleDims?.length,
    width: singleDims?.width,
    height: singleDims?.height,
    dimensionUnit: singleDims?.unit,

    // Master case
    mcQuantity: mcQty,
    mcWeight: mcWeight?.value,
    mcWeightUnit: mcWeight?.unit,
    mcLength: mcDims?.length,
    mcWidth: mcDims?.width,
    mcHeight: mcDims?.height,
    mcDimensionUnit: mcDims?.unit,
  };
}

// ============================================================================
// Grouping Strategy
// ============================================================================

/**
 * Build a product group key from a CSV row.
 *
 * Groups by CATEGORY + NAME to create one Product per flavor-per-line,
 * e.g. "Skwezed ICE::Banana" → product with variants for each volume/strength.
 *
 * Adjust this function if your grouping needs differ.
 */
function getProductGroupKey(row: CsvRow): string {
  const category = (row.CATEGORY || "Unknown").trim();
  const name = (row.NAME || "Unknown").trim();
  return `${category}::${name}`;
}

/**
 * Derive the product-level SKU from the group key.
 * Uses the first variant's SKU base (strips the strength suffix).
 * e.g. "SKWBAI100-00" → "SKWBAI100"
 */
function deriveProductSku(rows: CsvRow[]): string {
  const firstSku = rows[0].SKU.trim();
  // Try to strip trailing -XX suffix for a product-level SKU
  const baseSku = firstSku.replace(/-\d+$/, "");
  return baseSku;
}

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parse an array of CSV rows into grouped ProductImportGroups.
 *
 * Usage:
 * ```ts
 * import { parse } from "csv-parse/sync";
 *
 * const rows = parse(csvContent, { columns: true, skip_empty_lines: true });
 * const result = parseProductCsv(rows);
 *
 * for (const group of result.groups) {
 *   await productRepository.upsertWithVariants(group.product, group.variants);
 * }
 * ```
 */
export function parseProductCsv(rows: CsvRow[]): ParseResult {
  const errors: string[] = [];
  let skipped = 0;

  // Group rows by product
  const groupMap = new Map<string, CsvRow[]>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Validate required fields
    if (!row.SKU?.trim()) {
      errors.push(`Row ${i + 1}: missing SKU`);
      skipped++;
      continue;
    }

    if (!row.NAME?.trim() && !row.PRODUCT?.trim()) {
      errors.push(`Row ${i + 1} (${row.SKU}): missing NAME and PRODUCT`);
      skipped++;
      continue;
    }

    const key = getProductGroupKey(row);
    const existing = groupMap.get(key);
    if (existing) {
      existing.push(row);
    } else {
      groupMap.set(key, [row]);
    }
  }

  // Convert groups to import format
  const groups: ProductImportGroup[] = [];

  for (const [key, groupRows] of groupMap) {
    const [category, name] = key.split("::");
    const productSku = deriveProductSku(groupRows);

    const product: UpsertProductData = {
      sku: productSku,
      name: name || groupRows[0].PRODUCT,
      brand: category, // CATEGORY = brand/product line (e.g. "Skwezed ICE")
      category: category,
    };

    const variants: UpsertVariantData[] = groupRows.map(rowToVariantData);

    groups.push({ product, variants });
  }

  return { groups, errors, skipped };
}

// ============================================================================
// Flat mode (no grouping — each row = 1 product + 1 variant)
// ============================================================================

/**
 * Alternative: parse each CSV row as its own product with a single variant.
 * Use this if every SKU should be its own product.
 */
export function parseProductCsvFlat(rows: CsvRow[]): ParseResult {
  const errors: string[] = [];
  let skipped = 0;
  const groups: ProductImportGroup[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (!row.SKU?.trim()) {
      errors.push(`Row ${i + 1}: missing SKU`);
      skipped++;
      continue;
    }

    const product: UpsertProductData = {
      sku: row.SKU.trim(),
      name: row.PRODUCT?.trim() || row.NAME?.trim() || row.SKU.trim(),
      brand: row.CATEGORY?.trim() || undefined,
      category: row.CATEGORY?.trim() || undefined,
    };

    const variant = rowToVariantData(row);

    groups.push({ product, variants: [variant] });
  }

  return { groups, errors, skipped };
}
