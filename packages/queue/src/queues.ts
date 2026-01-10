import { Queue } from "bullmq";
import { getConnection } from "./connection.js";
import type { WorkTaskJobData, ShopifySyncJobData } from "./types.js";

export const QUEUE_NAMES = {
  WORK_TASK: "work-task",
  SHOPIFY_SYNC: "shopify-sync",
} as const;

let _workTaskQueue: Queue<WorkTaskJobData> | null = null;
let _shopifySyncQueue: Queue<ShopifySyncJobData> | null = null;

export function getWorkTaskQueue(): Queue<WorkTaskJobData> {
  if (!_workTaskQueue) {
    _workTaskQueue = new Queue<WorkTaskJobData>(QUEUE_NAMES.WORK_TASK, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { age: 24 * 3600, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    });
  }
  return _workTaskQueue;
}

export function getShopifySyncQueue(): Queue<ShopifySyncJobData> {
  if (!_shopifySyncQueue) {
    _shopifySyncQueue = new Queue<ShopifySyncJobData>(
      QUEUE_NAMES.SHOPIFY_SYNC,
      {
        connection: getConnection(),
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: "exponential", delay: 2000 },
        },
      }
    );
  }
  return _shopifySyncQueue;
}

export async function enqueueWorkTask(
  jobName: string,
  data: WorkTaskJobData,
  options?: { priority?: number; delay?: number }
) {
  return getWorkTaskQueue().add(jobName, data, {
    priority: options?.priority,
    delay: options?.delay,
  });
}

export async function enqueueShopifySync(
  jobName: string,
  data: ShopifySyncJobData
) {
  return getShopifySyncQueue().add(jobName, data);
}
