import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { healthRoutes } from "./routes/health.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { shopifyWebhookRoutes } from "./routes/webhooks/shopify/orders/create.js";
import { productImportRoutes } from "./routes/product.routes.js";
import { authenticate } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error.js";
import Redis from "ioredis";

export async function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV === "development",
  });

  // Redis-backed rate limiting
  const redis = new Redis(process.env.REDIS_URL!, {
    tls: process.env.REDIS_URL?.startsWith("rediss://") ? {} : undefined,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    redis,
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (request, context) => ({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: `Too many requests. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
      },
    }),
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  app.setErrorHandler(errorHandler);

  // ============================================================================
  // Public Routes (no auth required)
  // ============================================================================
  await app.register(healthRoutes, { prefix: "/health" });
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(shopifyWebhookRoutes, { prefix: "/webhooks/shopify" });

  // ============================================================================
  // Protected Routes (auth required)
  // ============================================================================
  await app.register(async (protectedRoutes) => {
    // Add auth hook to all routes in this scope
    protectedRoutes.addHook("onRequest", authenticate);

    // Register protected routes
    await protectedRoutes.register(productImportRoutes, {
      prefix: "/products",
    });
    // await protectedRoutes.register(orderRoutes, { prefix: "/orders" });
    // await protectedRoutes.register(inventoryRoutes, { prefix: "/inventory" });
    // await protectedRoutes.register(taskRoutes, { prefix: "/tasks" });
    // await protectedRoutes.register(userRoutes, { prefix: "/users" });
  });

  return app;
}

// import Fastify from "fastify";
// import cors from "@fastify/cors";
// import rateLimit from "@fastify/rate-limit";
// import { healthRoutes } from "./routes/health.routes.js";
// import { authRoutes } from "./routes/auth.routes.js";
// import { shopifyWebhookRoutes } from "./routes/webhooks/shopify/orders/create.js";
// import { productImportRoutes } from "./routes/product.routes.js";

// import { errorHandler } from "./middleware/error.js";
// import Redis from "ioredis";

// export async function buildApp() {
//   const app = Fastify({
//     logger: process.env.NODE_ENV === "development",
//   });

//   // Redis-backed rate limiting for multiple instances
//   const redis = new Redis(process.env.REDIS_URL!, {
//     tls: process.env.REDIS_URL?.startsWith("rediss://") ? {} : undefined,
//   });

//   // Rate limiting
//   await app.register(rateLimit, {
//     max: 100,
//     timeWindow: "1 minute",
//     redis,
//     keyGenerator: (request) => request.ip,
//     errorResponseBuilder: (request, context) => ({
//       error: {
//         code: "RATE_LIMIT_EXCEEDED",
//         message: `Too many requests. Try again in ${Math.ceil(
//           context.ttl / 1000,
//         )} seconds.`,
//       },
//     }),
//   });

//   await app.register(cors, {
//     origin: true,
//     credentials: true,
//   });

//   app.setErrorHandler(errorHandler);

//   await app.register(healthRoutes, { prefix: "/health" });
//   await app.register(authRoutes, { prefix: "/auth" });
//   await app.register(shopifyWebhookRoutes, { prefix: "/webhooks/shopify" });
//   await app.register(productImportRoutes, { prefix: "/products" });

//   return app;
// }
