/**
 * Queue Instances & Helpers
 * Functions to enqueue jobs from the API
 */

import { Queue, type JobsOptions } from "bullmq";
import { getConnection } from "./connection.js";
import {
  QUEUES,
  WORK_TASK_JOBS,
  type CreatePickingTaskJobData,
  type AssignTaskJobData,
  type StartTaskJobData,
  type CancelTaskJobData,
} from "./types.js";

// ============================================================================
// Queue Instances
// ============================================================================

let workTaskQueue: Queue | null = null;

export function getWorkTaskQueue(): Queue {
  if (!workTaskQueue) {
    workTaskQueue = new Queue(QUEUES.WORK_TASKS, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: {
          count: 1000,
          age: 24 * 60 * 60,
        },
        removeOnFail: {
          count: 5000,
          age: 7 * 24 * 60 * 60,
        },
      },
    });
  }
  return workTaskQueue;
}

// ============================================================================
// Enqueue Helpers
// ============================================================================

const DEFAULT_JOB_OPTIONS: JobsOptions = {};

/**
 * Enqueue a job to create a picking task for orders
 */
export async function enqueueCreatePickingTask(
  data: CreatePickingTaskJobData,
  options?: JobsOptions,
) {
  const queue = getWorkTaskQueue();
  return queue.add(WORK_TASK_JOBS.CREATE_PICKING_TASK, data, {
    ...DEFAULT_JOB_OPTIONS,
    ...options,
    // Use idempotencyKey as job ID to prevent duplicates
    jobId: data.idempotencyKey,
  });
}

/**
 * Enqueue a job to assign a task to a user
 */
export async function enqueueAssignTask(
  data: AssignTaskJobData,
  options?: JobsOptions,
) {
  const queue = getWorkTaskQueue();
  return queue.add(WORK_TASK_JOBS.ASSIGN_TASK, data, {
    ...DEFAULT_JOB_OPTIONS,
    ...options,
  });
}

/**
 * Enqueue a job to start a task
 */
export async function enqueueStartTask(
  data: StartTaskJobData,
  options?: JobsOptions,
) {
  const queue = getWorkTaskQueue();
  return queue.add(WORK_TASK_JOBS.START_TASK, data, {
    ...DEFAULT_JOB_OPTIONS,
    ...options,
  });
}

/**
 * Enqueue a job to cancel a task
 */
export async function enqueueCancelTask(
  data: CancelTaskJobData,
  options?: JobsOptions,
) {
  const queue = getWorkTaskQueue();
  return queue.add(WORK_TASK_JOBS.CANCEL_TASK, data, {
    ...DEFAULT_JOB_OPTIONS,
    ...options,
  });
}

// ============================================================================
// Queue Management
// ============================================================================

/**
 * Get queue stats
 */
export async function getWorkTaskQueueStats() {
  const queue = getWorkTaskQueue();
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Close all queues
 */
export async function closeQueues() {
  if (workTaskQueue) {
    await workTaskQueue.close();
    workTaskQueue = null;
  }
}

// import { Queue } from "bullmq";
// import { getConnection } from "./connection.js";
// import type { WorkTaskJobData, ShopifySyncJobData } from "./types.js";

// export const QUEUE_NAMES = {
//   WORK_TASK: "work-task",
//   SHOPIFY_SYNC: "shopify-sync",
// } as const;

// let _workTaskQueue: Queue<WorkTaskJobData> | null = null;
// let _shopifySyncQueue: Queue<ShopifySyncJobData> | null = null;

// export function getWorkTaskQueue(): Queue<WorkTaskJobData> {
//   if (!_workTaskQueue) {
//     _workTaskQueue = new Queue<WorkTaskJobData>(QUEUE_NAMES.WORK_TASK, {
//       connection: getConnection(),
//       defaultJobOptions: {
//         attempts: 3,
//         backoff: { type: "exponential", delay: 1000 },
//         removeOnComplete: { age: 24 * 3600, count: 1000 },
//         removeOnFail: { age: 7 * 24 * 3600 },
//       },
//     });
//   }
//   return _workTaskQueue;
// }

// export function getShopifySyncQueue(): Queue<ShopifySyncJobData> {
//   if (!_shopifySyncQueue) {
//     _shopifySyncQueue = new Queue<ShopifySyncJobData>(
//       QUEUE_NAMES.SHOPIFY_SYNC,
//       {
//         connection: getConnection(),
//         defaultJobOptions: {
//           attempts: 5,
//           backoff: { type: "exponential", delay: 2000 },
//         },
//       }
//     );
//   }
//   return _shopifySyncQueue;
// }

// export async function enqueueWorkTask(
//   jobName: string,
//   data: WorkTaskJobData,
//   options?: { priority?: number; delay?: number }
// ) {
//   return getWorkTaskQueue().add(jobName, data, {
//     priority: options?.priority,
//     delay: options?.delay,
//   });
// }

// export async function enqueueShopifySync(
//   jobName: string,
//   data: ShopifySyncJobData
// ) {
//   return getShopifySyncQueue().add(jobName, data);
// }
