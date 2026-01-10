import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyAccessToken, type JWTPayload } from "@wms/auth";

declare module "fastify" {
  interface FastifyRequest {
    user: JWTPayload;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({
      error: { code: "UNAUTHORIZED", message: "Missing authorization header" },
    });
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyAccessToken(token);
    request.user = payload;
  } catch {
    return reply.status(401).send({
      error: { code: "UNAUTHORIZED", message: "Invalid or expired token" },
    });
  }
}
