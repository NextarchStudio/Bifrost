import type { ApiError } from "@bifrost/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AuthService } from "../auth/service.js";
import type { EquipmentService } from "./service.js";

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
}

async function authenticate(request: FastifyRequest, auth: AuthService) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new Error("missing bearer token");
  return auth.authenticate(header.slice("Bearer ".length));
}
