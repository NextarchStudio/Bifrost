import type { ApiError } from "@bifrost/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticationErrorCode, LOGISTICS_ROLES, requireRoleAccess } from "../../http/authorization.js";
import { AuthenticationError, type AuthService } from "../auth/service.js";
import { WarehouseDomainError, type WarehouseService } from "./service.js";

const idSchema = z.coerce.number().int().min(1);
const palletSchema = z.object({
  locationId: z.coerce.number().int().min(1),
  name: z.string().trim().min(1).max(80),
  qrCode: z.string().trim().min(1).max(120),
});
const slotSchema = z.object({ slotNumber: z.coerce.number().int().min(1).max(65_535), status: z.string().trim().min(1).max(20) });
const moveSchema = z.object({ locationId: z.coerce.number().int().min(1) });
const equipmentSchema = z.object({ palletQrCode: z.string().trim().min(1).max(120), equipmentBarcode: z.string().trim().min(1).max(150) });

export async function registerWarehouseRoutes(app: FastifyInstance, auth: AuthService, warehouse: WarehouseService): Promise<void> {
  app.get("/api/v1/pallets", async (request, reply) => {
    try { await requireRoleAccess(request, auth, LOGISTICS_ROLES, "Du har ikke tilgang til lageret."); return warehouse.listPallets(); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.get("/api/v1/pallets/:id", async (request, reply) => {
    try { await requireRoleAccess(request, auth, LOGISTICS_ROLES, "Du har ikke tilgang til lageret."); return warehouse.inspectPallet(parseId(request.params)); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/pallets", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, LOGISTICS_ROLES, "Du har ikke tilgang til lageret.");
      return reply.code(201).send(await warehouse.createPallet(palletSchema.parse(request.body), user.id));
    } catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/pallets/:id/slots", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, LOGISTICS_ROLES, "Du har ikke tilgang til lageret.");
      return reply.code(201).send(await warehouse.createSlot(parseId(request.params), slotSchema.parse(request.body), user.id));
    } catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/pallets/equipment", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, LOGISTICS_ROLES, "Du har ikke tilgang til lageret.");
      const body = equipmentSchema.parse(request.body);
      await warehouse.addEquipmentByBarcode(body.palletQrCode, body.equipmentBarcode, user.id);
      return reply.code(204).send();
    } catch (error) { return sendError(error, request, reply); }
  });

  app.patch("/api/v1/pallets/:id/location", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, LOGISTICS_ROLES, "Du har ikke tilgang til lageret.");
      const body = moveSchema.parse(request.body);
      await warehouse.movePallet(parseId(request.params), body.locationId, user.id);
      return reply.code(204).send();
    } catch (error) { return sendError(error, request, reply); }
  });

  app.delete("/api/v1/pallets/:id", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, LOGISTICS_ROLES, "Du har ikke tilgang til lageret.");
      await warehouse.deletePallet(parseId(request.params), user.id);
      return reply.code(204).send();
    } catch (error) { return sendError(error, request, reply); }
  });
}

function parseId(params: unknown): number {
  return idSchema.parse((params as { id?: unknown }).id);
}

function sendError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  let statusCode = 500; let code = "INTERNAL_ERROR"; let message = "En intern feil oppstod.";
  if (error instanceof AuthenticationError) { statusCode = error.statusCode; code = authenticationErrorCode(error); message = error.message; }
  else if (error instanceof WarehouseDomainError) { statusCode = error.code === "NOT_FOUND" ? 404 : 409; code = error.code; message = error.message; }
  else if (error instanceof z.ZodError) { statusCode = 400; code = "INVALID_BODY"; message = "Ugyldige lagerdata."; }
  const body: ApiError = { error: { code, message, requestId: request.id } };
  return reply.code(statusCode).send(body);
}
