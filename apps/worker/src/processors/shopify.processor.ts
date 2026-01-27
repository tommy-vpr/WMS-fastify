/**
 * Shopify Processor
 * Handles Shopify webhook jobs
 */

import { Job } from "bullmq";
import { prisma } from "@wms/db";
import { SHOPIFY_JOBS, type ShopifyOrderCreateJobData } from "@wms/queue";

// ============================================================================
// Order Processing (moved from your webhook handler)
// ============================================================================

async function processShopifyOrderCreate(job: Job<ShopifyOrderCreateJobData>) {
  const { shopifyOrderId, payload } = job.data;
  const shopifyOrder = payload as any;

  // Debug - see what we actually received
  console.log("[Shopify] Payload keys:", Object.keys(payload));
  console.log("[Shopify] payload.id:", shopifyOrder.id);
  console.log("[Shopify] payload.name:", shopifyOrder.name);
  console.log("[Shopify] payload.order_number:", shopifyOrder.order_number);

  // Use the REAL Shopify order ID from payload, not the job data
  const realShopifyOrderId = shopifyOrder.id?.toString() || shopifyOrderId;
  const orderNumber =
    shopifyOrder.name ||
    shopifyOrder.order_number ||
    `SHOP-${realShopifyOrderId}`;

  console.log(`[Shopify] Processing order: ${orderNumber}`);

  return await prisma.$transaction(async (tx) => {
    // 1. Idempotency check
    const existing = await tx.order.findUnique({
      where: { shopifyOrderId },
    });

    if (existing) {
      console.log(`[Shopify] Order already exists: ${existing.orderNumber}`);
      return { orderId: existing.id, status: "already_exists" };
    }

    // 2. Extract customer name
    let customerName = "Unknown Customer";
    if (shopifyOrder.shipping_address) {
      customerName =
        `${shopifyOrder.shipping_address.first_name || ""} ${shopifyOrder.shipping_address.last_name || ""}`.trim();
    } else if (shopifyOrder.customer) {
      customerName =
        `${shopifyOrder.customer.first_name || ""} ${shopifyOrder.customer.last_name || ""}`.trim();
    }

    // 3. Fetch fulfillment order line items (for modern Shopify API)
    const fulfillmentLineItems =
      await fetchFulfillmentOrderLineItems(shopifyOrderId);

    // 4. Create order
    const order = await tx.order.create({
      data: {
        shopifyOrderId: realShopifyOrderId,
        orderNumber, // Now guaranteed to have a value
        customerName,
        customerEmail: shopifyOrder.email,
        totalAmount: parseFloat(shopifyOrder.total_price || "0"),
        shippingAddress: shopifyOrder.shipping_address || {},
        billingAddress: shopifyOrder.billing_address || {},
        status: "PENDING",
        paymentStatus: mapPaymentStatus(shopifyOrder.financial_status),
        shopifyLineItems: shopifyOrder.line_items?.map((li: any) => ({
          id: li.id?.toString(),
          variantId: li.variant_id?.toString(),
          sku: li.sku,
          quantity: li.quantity,
        })),
      },
    });

    // 5. Create order items
    const lineItems = shopifyOrder.line_items || [];
    let itemsCreated = 0;

    for (const lineItem of lineItems) {
      const productVariant = await findOrCreateVariant(tx, lineItem);

      if (!productVariant) {
        console.warn(
          `[Shopify] Skipping item - variant not found: ${lineItem.sku}`,
        );
        continue;
      }

      const variantGid = lineItem.variant_id
        ? `gid://shopify/ProductVariant/${lineItem.variant_id}`
        : null;
      const foLineItemId = variantGid
        ? fulfillmentLineItems.get(variantGid)
        : null;

      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productVariantId: productVariant.id,
          sku: productVariant.sku,
          quantity: lineItem.quantity,
          unitPrice: parseFloat(lineItem.price || "0"),
          shopifyLineItemId: lineItem.id?.toString(),
          shopifyFulfillmentOrderLineItemId: foLineItemId || undefined,
        },
      });

      itemsCreated++;
    }

    console.log(
      `[Shopify] Created order ${order.orderNumber} with ${itemsCreated} items`,
    );

    // 6. Notify via Ably (optional)
    // await notifyRole('STAFF', 'new-order', { ... });

    // 7. Auto-allocate if enabled
    if (process.env.AUTO_ALLOCATE_ORDERS === "true") {
      // Enqueue allocation job
      // await enqueueCreatePickingTask({ orderIds: [order.id], ... });
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      itemsCreated,
      status: "created",
    };
  });
}

// ============================================================================
// Helpers
// ============================================================================

async function fetchFulfillmentOrderLineItems(
  shopifyOrderId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;

  if (!domain || !token) return map;

  try {
    const query = `
      query($orderId: ID!) {
        order(id: $orderId) {
          fulfillmentOrders(first: 5) {
            edges {
              node {
                lineItems(first: 50) {
                  edges {
                    node {
                      id
                      lineItem {
                        variant { id }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch(
      `https://${domain}/admin/api/2025-01/graphql.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          variables: { orderId: `gid://shopify/Order/${shopifyOrderId}` },
        }),
      },
    );

    if (response.ok) {
      const result = await response.json();
      const fulfillmentOrders =
        result.data?.order?.fulfillmentOrders?.edges || [];

      for (const foEdge of fulfillmentOrders) {
        for (const liEdge of foEdge.node.lineItems.edges) {
          const variantGid = liEdge.node.lineItem.variant?.id;
          const foLineItemGid = liEdge.node.id;
          if (variantGid && foLineItemGid) {
            map.set(variantGid, foLineItemGid);
          }
        }
      }
    }
  } catch (error) {
    console.warn("[Shopify] Failed to fetch fulfillment line items:", error);
  }

  return map;
}

async function findOrCreateVariant(tx: any, lineItem: any) {
  // Try by SKU
  if (lineItem.sku) {
    const variant = await tx.productVariant.findUnique({
      where: { sku: lineItem.sku },
    });
    if (variant) return variant;
  }

  // Try by Shopify variant ID
  if (lineItem.variant_id) {
    const variant = await tx.productVariant.findUnique({
      where: { shopifyVariantId: lineItem.variant_id.toString() },
    });
    if (variant) return variant;
  }

  // Create if enabled
  if (process.env.CREATE_MISSING_PRODUCTS === "true") {
    const product = await tx.product.create({
      data: {
        sku: lineItem.sku || `SHOPIFY-${lineItem.variant_id}`,
        name: lineItem.title || lineItem.name,
        shopifyProductId: lineItem.product_id?.toString(),
      },
    });

    return tx.productVariant.create({
      data: {
        productId: product.id,
        sku: lineItem.sku || `SHOPIFY-${lineItem.variant_id}`,
        name: lineItem.variant_title || lineItem.title,
        shopifyVariantId: lineItem.variant_id?.toString(),
        sellingPrice: parseFloat(lineItem.price || "0"),
      },
    });
  }

  return null;
}

function mapPaymentStatus(
  shopifyStatus: string,
): "PENDING" | "PAID" | "REFUNDED" {
  switch (shopifyStatus) {
    case "paid":
      return "PAID";
    case "refunded":
    case "partially_refunded":
      return "REFUNDED";
    default:
      return "PENDING";
  }
}

// ============================================================================
// Main Processor
// ============================================================================

export async function processShopifyJob(job: Job): Promise<unknown> {
  console.log(`[Shopify] Processing job: ${job.name} (${job.id})`);

  switch (job.name) {
    case SHOPIFY_JOBS.ORDER_CREATE:
      return processShopifyOrderCreate(job as Job<ShopifyOrderCreateJobData>);

    case SHOPIFY_JOBS.ORDER_UPDATE:
      // TODO: Handle order updates
      return { status: "not_implemented" };

    case SHOPIFY_JOBS.ORDER_CANCEL:
      // TODO: Handle cancellations (release allocations)
      return { status: "not_implemented" };

    default:
      throw new Error(`Unknown Shopify job: ${job.name}`);
  }
}
