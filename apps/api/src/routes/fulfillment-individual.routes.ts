/**
 * Fulfillment Routes
 * REST endpoints for the fulfillment pipeline
 *
 * Save to: apps/api/src/routes/fulfillment.routes.ts
 *
 * Wires up PickingService, PackingService, and FulfillmentService (read-only).
 * All endpoints are unchanged — zero frontend modifications needed.
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import {
  PickingService,
  PackingService,
  FulfillmentService,
} from "@wms/domain";
import {
  pickingRepository,
  packingRepository,
  fulfillmentRepository,
} from "@wms/db";

// =============================================================================
// Route Plugin
// =============================================================================

export const fulfillmentIndividualRoutes: FastifyPluginAsync = async (app) => {
  const pickingService = new PickingService({ pickingRepo: pickingRepository });
  const packingService = new PackingService({ packingRepo: packingRepository });
  const fulfillmentService = new FulfillmentService({
    fulfillmentRepo: fulfillmentRepository,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/fulfillment/:orderId/status
  // ─────────────────────────────────────────────────────────────────────────

  app.get(
    "/:orderId/status",
    async (
      request: FastifyRequest<{ Params: { orderId: string } }>,
      reply: FastifyReply,
    ) => {
      const { orderId } = request.params;
      try {
        const status = await fulfillmentService.getFulfillmentStatus(orderId);
        return reply.send(status);
      } catch (err: any) {
        return reply.status(404).send({ error: err.message });
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/fulfillment/:orderId/events
  // ─────────────────────────────────────────────────────────────────────────

  app.get(
    "/:orderId/events",
    async (
      request: FastifyRequest<{
        Params: { orderId: string };
        Querystring: { sinceEventId?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const { orderId } = request.params;
      const { sinceEventId } = request.query;
      try {
        const events = await fulfillmentService.getEventsSince(
          orderId,
          sinceEventId,
        );
        return reply.send({ events });
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/fulfillment/:orderId/pick
  // ─────────────────────────────────────────────────────────────────────────

  app.post(
    "/:orderId/pick",
    async (
      request: FastifyRequest<{ Params: { orderId: string } }>,
      reply: FastifyReply,
    ) => {
      const { orderId } = request.params;
      const userId = (request as any).user?.id;
      try {
        const result = await pickingService.generatePickList(orderId, userId);
        return reply.status(201).send(result);
      } catch (err: any) {
        const status = err.message.includes("not found") ? 404 : 400;
        return reply.status(status).send({ error: err.message });
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/fulfillment/:orderId/pick/:taskItemId/confirm
  // ─────────────────────────────────────────────────────────────────────────

  app.post(
    "/:orderId/pick/:taskItemId/confirm",
    async (
      request: FastifyRequest<{
        Params: { orderId: string; taskItemId: string };
        Body: {
          quantity?: number;
          locationScanned?: boolean;
          itemScanned?: boolean;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const { taskItemId } = request.params;
      const body = (request.body ?? {}) as any;
      const userId = (request as any).user?.id;
      try {
        const result = await pickingService.confirmPickItem(taskItemId, {
          quantity: body.quantity,
          locationScanned: body.locationScanned,
          itemScanned: body.itemScanned,
          userId,
        });
        return reply.send(result);
      } catch (err: any) {
        const status = err.message.includes("not found") ? 404 : 400;
        return reply.status(status).send({ error: err.message });
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/fulfillment/:orderId/pack/complete-from-bin
  // ─────────────────────────────────────────────────────────────────────────

  app.post(
    "/:orderId/pack/complete-from-bin",
    async (
      request: FastifyRequest<{
        Params: { orderId: string };
        Body: {
          binId: string;
          weight: number;
          weightUnit?: string;
          dimensions?: {
            length: number;
            width: number;
            height: number;
            unit: string;
          };
        };
      }>,
      reply: FastifyReply,
    ) => {
      const { orderId } = request.params;
      const { binId, weight, weightUnit, dimensions } = request.body as any;
      const userId = (request as any).user?.id;
      try {
        const result = await packingService.completePackingFromBin(
          orderId,
          binId,
          { weight, weightUnit, dimensions, userId },
        );
        return reply.send(result);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/fulfillment/:orderId/pack
  // ─────────────────────────────────────────────────────────────────────────

  app.post(
    "/:orderId/pack",
    async (
      request: FastifyRequest<{ Params: { orderId: string } }>,
      reply: FastifyReply,
    ) => {
      const { orderId } = request.params;
      const userId = (request as any).user?.id;
      try {
        const result = await packingService.generatePackList(orderId, userId);
        return reply.status(201).send(result);
      } catch (err: any) {
        const status = err.message.includes("not found") ? 404 : 400;
        return reply.status(status).send({ error: err.message });
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/fulfillment/:orderId/pack/:taskItemId/verify
  // ─────────────────────────────────────────────────────────────────────────

  app.post(
    "/:orderId/pack/:taskItemId/verify",
    async (
      request: FastifyRequest<{
        Params: { orderId: string; taskItemId: string };
      }>,
      reply: FastifyReply,
    ) => {
      const { taskItemId } = request.params;
      const userId = (request as any).user?.id;
      try {
        const result = await packingService.verifyPackItem(taskItemId, {
          userId,
        });
        return reply.send(result);
      } catch (err: any) {
        const status = err.message.includes("not found") ? 404 : 400;
        return reply.status(status).send({ error: err.message });
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/fulfillment/:orderId/pack/complete
  // ─────────────────────────────────────────────────────────────────────────

  app.post(
    "/:orderId/pack/complete",
    async (
      request: FastifyRequest<{
        Params: { orderId: string };
        Body: {
          taskId: string;
          weight: number;
          weightUnit?: string;
          dimensions?: {
            length: number;
            width: number;
            height: number;
            unit: string;
          };
        };
      }>,
      reply: FastifyReply,
    ) => {
      const body = request.body as any;
      const userId = (request as any).user?.id;
      if (!body.taskId || body.weight == null) {
        return reply
          .status(400)
          .send({ error: "taskId and weight are required" });
      }
      try {
        const result = await packingService.completePacking(body.taskId, {
          weight: body.weight,
          weightUnit: body.weightUnit,
          dimensions: body.dimensions,
          userId,
        });
        return reply.send(result);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/fulfillment/bin/:barcode
  // ─────────────────────────────────────────────────────────────────────────

  app.get(
    "/bin/:barcode",
    async (
      request: FastifyRequest<{ Params: { barcode: string } }>,
      reply: FastifyReply,
    ) => {
      const { barcode } = request.params;
      try {
        const result = await pickingService.getOrderByBinBarcode(barcode);
        return reply.send(result);
      } catch (err: any) {
        return reply.status(404).send({ error: err.message });
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/fulfillment/bin/:binId/verify
  // ─────────────────────────────────────────────────────────────────────────

  app.post(
    "/bin/:binId/verify",
    async (
      request: FastifyRequest<{
        Params: { binId: string };
        Body: { barcode: string };
      }>,
      reply: FastifyReply,
    ) => {
      const { binId } = request.params;
      const { barcode } = request.body as any;
      const userId = (request as any).user?.id;
      if (!barcode)
        return reply.status(400).send({ error: "barcode is required" });
      try {
        const result = await packingService.verifyBinItem(
          binId,
          barcode,
          userId,
        );
        return reply.send(result);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/fulfillment/bin/:binId/complete
  // ─────────────────────────────────────────────────────────────────────────

  app.post(
    "/bin/:binId/complete",
    async (
      request: FastifyRequest<{ Params: { binId: string } }>,
      reply: FastifyReply,
    ) => {
      const { binId } = request.params;
      const userId = (request as any).user?.id;
      try {
        await packingService.completeBin(binId, userId);
        return reply.send({ success: true });
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    },
  );
};
