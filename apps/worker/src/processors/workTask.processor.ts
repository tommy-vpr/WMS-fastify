import type { Job } from "bullmq";
import { prisma } from "@wms/db";
import type { WorkTaskJobData, JobResult } from "@wms/queue";

export async function processWorkTask(job: Job<WorkTaskJobData>): Promise<JobResult> {
  const { taskId, action, userId } = job.data;

  console.log(`Processing task ${taskId}: ${action}`);

  const task = await prisma.workTask.findUnique({ where: { id: taskId } });

  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  switch (action) {
    case "process":
      if (task.status === "PENDING") {
        await prisma.workTask.update({
          where: { id: taskId },
          data: { status: "ASSIGNED" },
        });
      }
      break;

    case "complete":
      await prisma.workTask.update({
        where: { id: taskId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      if (userId) {
        await prisma.taskEvent.create({
          data: { taskId, eventType: "TASK_COMPLETED", userId },
        });
      }
      break;

    case "cancel":
      await prisma.workTask.update({
        where: { id: taskId },
        data: { status: "CANCELLED" },
      });
      if (userId) {
        await prisma.taskEvent.create({
          data: { taskId, eventType: "TASK_CANCELLED", userId },
        });
      }
      break;
  }

  return { success: true, message: `Task ${taskId} ${action} completed` };
}
