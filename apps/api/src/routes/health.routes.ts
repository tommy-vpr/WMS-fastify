import type { FastifyInstance } from "fastify";
import { prisma } from "@wms/db";
import Redis from "ioredis";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  app.get("/ready", async (request, reply) => {
    const checks: Record<string, boolean> = {};

    // Check database
    try {
      await prisma.$executeRawUnsafe("SELECT 1");

      checks.database = true;
    } catch (e) {
      console.error("DB check failed:", e);
      checks.database = false;
    }

    // Check Redis (with TLS for Upstash)
    try {
      const redisUrl = process.env.REDIS_URL!;
      const redis = new Redis(redisUrl, {
        tls: redisUrl.startsWith("rediss://") ? {} : undefined,
        maxRetriesPerRequest: 3,
      });
      const pong = await redis.ping();
      checks.redis = pong === "PONG";
      await redis.quit();
    } catch (e) {
      console.error("Redis check failed:", e);
      checks.redis = false;
    }

    const allHealthy = Object.values(checks).every(Boolean);

    return reply.status(allHealthy ? 200 : 503).send({
      status: allHealthy ? "ready" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    });
  });
}
