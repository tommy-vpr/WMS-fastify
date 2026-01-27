/**
 * WMS Worker
 * BullMQ worker that processes background jobs
 */

import "dotenv/config";
import { Worker, type Job } from "bullmq";
import {
  getConnection,
  QUEUES,
  WORK_TASK_JOBS,
  SHOPIFY_JOBS,
} from "@wms/queue";
import { processWorkTaskJob } from "./processors/index.js";
import { processShopifyJob } from "./processors/shopify.processor.js";

// Add Shopify worker
function createShopifyWorker() {
  const connection = getConnection();

  const worker = new Worker(
    QUEUES.SHOPIFY,
    async (job: Job) => processShopifyJob(job),
    {
      connection,
      concurrency: 3, // Lower concurrency for external API calls
      removeOnComplete: { count: 1000, age: 24 * 60 * 60 },
      removeOnFail: { count: 5000, age: 7 * 24 * 60 * 60 },
    },
  );

  worker.on("ready", () => console.log("[Worker] shopify worker ready"));
  worker.on("completed", (job, result) => {
    console.log(`[Shopify] Job completed: ${job.name}`, result);
  });
  worker.on("failed", (job, err) => {
    console.error(`[Shopify] Job failed: ${job?.name}`, err.message);
  });

  return worker;
}

// ============================================================================
// Configuration
// ============================================================================

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "5", 10);

// ============================================================================
// Worker Setup
// ============================================================================

function createWorkTaskWorker() {
  const connection = getConnection();

  const worker = new Worker(
    QUEUES.WORK_TASKS,
    async (job: Job) => {
      return processWorkTaskJob(job);
    },
    {
      connection,
      concurrency: WORKER_CONCURRENCY,
      removeOnComplete: {
        count: 1000, // Keep last 1000 completed jobs
        age: 24 * 60 * 60, // Remove jobs older than 24 hours
      },
      removeOnFail: {
        count: 5000, // Keep last 5000 failed jobs
        age: 7 * 24 * 60 * 60, // Remove failed jobs older than 7 days
      },
    },
  );

  worker.on("ready", () => {
    console.log(`[Worker] ${QUEUES.WORK_TASKS} worker ready`);
  });

  worker.on("completed", (job, result) => {
    console.log(`[Worker] Job completed: ${job.name} (${job.id})`, result);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[Worker] Job failed: ${job?.name} (${job?.id})`,
      err.message,
    );
  });

  worker.on("error", (err) => {
    console.error("[Worker] Worker error:", err);
  });

  return worker;
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

async function shutdown(workers: Worker[]) {
  console.log("\n[Worker] Shutting down...");

  // Close all workers
  await Promise.all(workers.map((w) => w.close()));
  console.log("[Worker] All workers closed");

  process.exit(0);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("========================================");
  console.log("  WMS Worker Starting");
  console.log("========================================");
  console.log(
    `[Config] Redis: ${process.env.REDIS_URL || "redis://localhost:6379"}`,
  );
  console.log(`[Config] Concurrency: ${WORKER_CONCURRENCY}`);
  console.log("");

  // Create workers
  const workers: Worker[] = [];

  // Work Tasks Worker
  const workTaskWorker = createWorkTaskWorker();
  const shopifyWorker = createShopifyWorker();

  workers.push(workTaskWorker, shopifyWorker);

  // Register shutdown handlers
  process.on("SIGTERM", () => shutdown(workers));
  process.on("SIGINT", () => shutdown(workers));

  console.log("[Worker] Workers started, waiting for jobs...");
  console.log("");
  console.log("Available job types:");
  Object.values(WORK_TASK_JOBS).forEach((job) => {
    console.log(`  - ${QUEUES.WORK_TASKS}:${job}`);
  });
  Object.values(SHOPIFY_JOBS).forEach((job) => {
    console.log(`  - ${QUEUES.SHOPIFY}:${job}`);
  });
  console.log("");
}

main().catch((err) => {
  console.error("[Worker] Fatal error:", err);
  process.exit(1);
});

// import { config } from "dotenv";
// import { resolve } from "path";
// import { fileURLToPath } from "url";

// // Load .env from monorepo root FIRST
// const __dirname = fileURLToPath(new URL(".", import.meta.url));
// config({ path: resolve(__dirname, "../../../.env") });

// import { Worker } from "bullmq";
// import { QUEUE_NAMES, getConnection } from "@wms/queue";
// import { processWorkTask } from "./processors/workTask.processor.js";

// console.log("🔧 Starting worker...");
// console.log("REDIS_URL:", process.env.REDIS_URL ? "✓" : "✗");

// const workTaskWorker = new Worker(
//   QUEUE_NAMES.WORK_TASK,
//   processWorkTask,
//   {
//     connection: getConnection(),
//     concurrency: 5,
//   }
// );

// workTaskWorker.on("completed", (job) => {
//   console.log(`✅ Job ${job.id} completed`);
// });

// workTaskWorker.on("failed", (job, err) => {
//   console.error(`❌ Job ${job?.id} failed:`, err.message);
// });

// async function shutdown() {
//   console.log("🛑 Shutting down...");
//   await workTaskWorker.close();
//   process.exit(0);
// }

// process.on("SIGTERM", shutdown);
// process.on("SIGINT", shutdown);

// console.log("✅ Worker running");
