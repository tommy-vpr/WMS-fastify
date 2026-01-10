export interface WorkTaskJobData {
  taskId: string;
  type: string;
  action: "process" | "assign" | "complete" | "cancel";
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface ShopifySyncJobData {
  syncType: "orders" | "products" | "inventory" | "fulfillment";
  orderId?: string;
  productId?: string;
  action: "sync" | "webhook";
  payload?: Record<string, unknown>;
}

export interface JobResult {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
}
