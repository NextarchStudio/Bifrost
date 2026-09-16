import type { ApiError } from "@bifrost/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AuthenticationError, type AuthService } from "../auth/service.js";
import { EquipmentDomainError, type EquipmentService } from "./service.js";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(150).optional(),
  status: z.string().trim().max(30).optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(150),
  category: z.string().trim().min(2).max(80),
  serialNumber: z.string().trim().min(2).max(150),
  quantity: z.coerce.number().int().min(1).max(1_000_000),
  notes: z.string().trim().max(4_000).optional(),
});

const idSchema = z.coerce.number().int().min(1);
const detailsSchema = z.object({
  name: z.string().trim().min(2).max(150),
  serialNumber: z.string().trim().min(2).max(150),
  quantity: z.coerce.number().int().min(0).max(1_000_000),
});
const quantitySchema = z.object({ quantity: z.coerce.number().int().min(0).max(1_000_000) });
const statusSchema = z.object({ status: z.string().trim().min(1).max(30) });
const moveSchema = z.object({ palletQrCode: z.string().trim().min(1).max(120) });

const allowedRoles = new Set(["developer", "chief", "co-chief", "logistikk"]);

export async function registerEquipmentRoutes(
  app: FastifyInstance,
  auth: AuthService,
  equipment: EquipmentService,
): Promise<void> {
  app.get("/api/v1/equipment", async (request, reply) => {
    const user = await authenticate(request, auth).catch(() => null);
    if (!user) {
      const body: ApiError = { error: { code: "UNAUTHORIZED", message: "Gyldig innlogging kreves.", requestId: request.id } };
      return reply.code(401).send(body);
    }
    if (!user.roles.some((role) => allowedRoles.has(role))) {
      const body: ApiError = { error: { code: "FORBIDDEN", message: "Du har ikke tilgang til utstyrsoversikten.", requestId: request.id } };
      return reply.code(403).send(body);
    }

    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      const body: ApiError = { error: { code: "INVALID_QUERY", message: "Ugyldig søk eller paginering.", requestId: request.id } };
      return reply.code(400).send(body);
    }
    return equipment.list(parsed.data);
  });

  app.post("/api/v1/equipment", async (request, reply) => {
    const user = await authenticate(request, auth).catch(() => null);
    if (!user) {
      const body: ApiError = { error: { code: "UNAUTHORIZED", message: "Gyldig innlogging kreves.", requestId: request.id } };
      return reply.code(401).send(body);
    }
    if (!user.roles.some((role) => allowedRoles.has(role))) {
      const body: ApiError = { error: { code: "FORBIDDEN", message: "Du har ikke tilgang til å opprette utstyr.", requestId: request.id } };
      return reply.code(403).send(body);
    }

    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      const body: ApiError = { error: { code: "INVALID_BODY", message: "Ugyldige utstyrsdata.", requestId: request.id } };
      return reply.code(400).send(body);
    }
    const result = await equipment.create(parsed.data, user.id);
    return reply.code(result.merged ? 200 : 201).send(result);
  });

  app.patch("/api/v1/equipment/:id", async (request, reply) => {
    try {
      const user = await requireAccess(request, auth);
      const id = parseId(request.params);
      const body = detailsSchema.parse(request.body);
      await equipment.updateDetails(id, body, user.id);
      return reply.code(204).send();
    } catch (error) {
      return sendMutationError(error, request, reply);
    }
  });

  app.patch("/api/v1/equipment/:id/quantity", async (request, reply) => {
    try {
      const user = await requireAccess(request, auth);
      const id = parseId(request.params);
      const body = quantitySchema.parse(request.body);
      await equipment.updateQuantity(id, body.quantity, user.id);
      return reply.code(204).send();
    } catch (error) {
      return sendMutationError(error, request, reply);
    }
  });

  app.patch("/api/v1/equipment/:id/status", async (request, reply) => {
    try {
      const user = await requireAccess(request, auth);
      const id = parseId(request.params);
      const body = statusSchema.parse(request.body);
      await equipment.updateStatus(id, body.status, user.id);
      return reply.code(204).send();
    } catch (error) {
      return sendMutationError(error, request, reply);
    }
  });

  app.post("/api/v1/equipment/:id/move", async (request, reply) => {
    try {
      const user = await requireAccess(request, auth);
      const id = parseId(request.params);
      const body = moveSchema.parse(request.body);
      await equipment.move(id, body.palletQrCode, user.id);
      return reply.code(204).send();
    } catch (error) {
      return sendMutationError(error, request, reply);
    }
  });

  app.delete("/api/v1/equipment/:id", async (request, reply) => {
    try {
      const user = await requireAccess(request, auth);
      const id = parseId(request.params);
      await equipment.delete(id, user.id);
      return reply.code(204).send();
    } catch (error) {
      return sendMutationError(error, request, reply);
    }
  });
}

async function authenticate(request: FastifyRequest, auth: AuthService) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new Error("missing bearer token");
  return auth.authenticate(header.slice("Bearer ".length));
}

async function requireAccess(request: FastifyRequest, auth: AuthService) {
  const user = await authenticate(request, auth);
  if (!user.roles.some((role) => allowedRoles.has(role))) throw new RouteAccessError("FORBIDDEN");
  return user;
}

function parseId(params: unknown): number {
  const value = typeof params === "object" && params !== null && "id" in params ? (params as { id: unknown }).id : undefined;
  return idSchema.parse(value);
}

class RouteAccessError extends Error {
  constructor(readonly kind: "FORBIDDEN") { super(kind); }
}

function sendMutationError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  let statusCode = 500;
  let code = "INTERNAL_ERROR";
  let message = "En intern feil oppstod.";
  if (error instanceof RouteAccessError) {
    statusCode = 403; code = "FORBIDDEN"; message = "Du har ikke tilgang til handlingen.";
  } else if (error instanceof EquipmentDomainError) {
    statusCode = error.code === "NOT_FOUND" ? 404 : 409; code = error.code; message = error.message;
  } else if (error instanceof z.ZodError) {
    statusCode = 400; code = "INVALID_BODY"; message = "Ugyldige data.";
  } else if (error instanceof AuthenticationError) {
    statusCode = error.statusCode; code = error.statusCode === 403 ? "FORBIDDEN" : "UNAUTHORIZED"; message = error.message;
  } else if (error instanceof Error && error.message === "missing bearer token") {
    statusCode = 401; code = "UNAUTHORIZED"; message = "Gyldig innlogging kreves.";
  }
  const body: ApiError = { error: { code, message, requestId: request.id } };
  return reply.code(statusCode).send(body);
}
