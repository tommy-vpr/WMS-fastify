import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

// Load .env from monorepo root FIRST
const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

import { Worker } from "bullmq";
import { QUEUE_NAMES, getConnection } from "@wms/queue";
import { processWorkTask } from "./processors/workTask.processor.js";

console.log("🔧 Starting worker...");
console.log("REDIS_URL:", process.env.REDIS_URL ? "✓" : "✗");

const workTaskWorker = new Worker(
  QUEUE_NAMES.WORK_TASK,
  processWorkTask,
  {
    connection: getConnection(),
    concurrency: 5,
  }
);

workTaskWorker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

workTaskWorker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

async function shutdown() {
  console.log("🛑 Shutting down...");
  await workTaskWorker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("✅ Worker running");
