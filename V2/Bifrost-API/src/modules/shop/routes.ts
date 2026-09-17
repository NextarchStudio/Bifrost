import type { ApiError } from "@bifrost/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticationErrorCode, requireRoleAccess } from "../../http/authorization.js";
import { AuthenticationError, type AuthService } from "../auth/service.js";
import {
  CREW_CLOTHING_ADMIN_ROLES,
  CREW_CLOTHING_ROLES,
  CrewClothingDomainError,
  type CrewClothingService,
} from "../crew-clothing/service.js";
import { buildShopCsv, buildShopPdf } from "./export.js";
import { parseShopImport } from "./import.js";
import { SHOP_ROLES, ShopDomainError, type ShopService } from "./service.js";

const idParamsSchema = z.object({ id: z.coerce.number().int().positive() });
const categorySchema = z.object({ name: z.string().trim().min(1).max(80) });
const itemSchema = z.object({
  name: z.string().trim().min(2).max(150),
  categoryId: z.number().int().positive().nullable().optional(),
  newCategory: z.string().trim().max(80).nullable().optional(),
  size: z.string().trim().max(20).nullable().optional(),
  quantity: z.number().int().min(0).max(1_000_000),
  notes: z.string().trim().max(4000).nullable().optional(),
}).refine((value) => Boolean(value.categoryId || value.newCategory?.trim()), { message: "Velg en kategori eller opprett en ny.", path: ["categoryId"] });
const movementSchema = z.object({ quantity: z.number().int().min(1).max(1_000_000) });
const lookupSchema = z.object({ query: z.string().trim().min(1).max(120) });
const crewSchema = z.object({ name: z.string().trim().min(1).max(120), tshirtMax: z.number().int().min(0).max(1000), hoodieMax: z.number().int().min(0).max(1000) });
const memberSchema = z.object({ crewId: z.number().int().positive().nullable().optional(), tshirtSize: z.string().trim().max(20).nullable().optional(), hoodieSize: z.string().trim().max(20).nullable().optional() });
const inventorySchema = z.object({ itemType: z.enum(["tshirt", "hoodie"]), size: z.string().trim().min(1).max(20), quantity: z.number().int().min(0).max(1_000_000) });
const deliverySchema = z.object({ itemTypes: z.array(z.enum(["tshirt", "hoodie"])).min(1).max(2), delivered: z.boolean() });

export async function registerShopRoutes(app: FastifyInstance, auth: AuthService, shop: ShopService, clothing: CrewClothingService): Promise<void> {
  app.get("/api/v1/shop", async (request, reply) => {
    try { await authorizeShop(request, auth); return await shop.workspace(); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/shop/categories", async (request, reply) => {
    try { const user = await authorizeShop(request, auth); return reply.code(201).send(await shop.createCategory(categorySchema.parse(request.body).name, user.id)); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/shop/items", async (request, reply) => {
    try { const user = await authorizeShop(request, auth); return reply.code(201).send(await shop.createItem(itemSchema.parse(request.body), user.id)); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/shop/items/:id/check-out", async (request, reply) => {
    try { const user = await authorizeShop(request, auth); const { id } = idParamsSchema.parse(request.params); await shop.move(id, "checkout", movementSchema.parse(request.body).quantity, user.id); return reply.code(204).send(); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/shop/items/:id/check-in", async (request, reply) => {
    try { const user = await authorizeShop(request, auth); const { id } = idParamsSchema.parse(request.params); await shop.move(id, "checkin", movementSchema.parse(request.body).quantity, user.id); return reply.code(204).send(); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.delete("/api/v1/shop/items/:id", async (request, reply) => {
    try { const user = await authorizeShop(request, auth); const { id } = idParamsSchema.parse(request.params); await shop.deleteItem(id, user.id); return reply.code(204).send(); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/shop/import", async (request, reply) => {
    try {
      const user = await authorizeShop(request, auth);
      const upload = await request.file();
      if (!upload) throw new ShopDomainError("Velg en Excel- eller CSV-fil som skal importeres.", "CONFLICT");
      let rows;
      try { rows = await parseShopImport(upload.filename, await upload.toBuffer()); }
      catch (error) { throw new ShopDomainError(error instanceof Error ? error.message : "Importfilen kunne ikke leses.", "CONFLICT"); }
      return await shop.importRows(rows, user.id);
    } catch (error) { return sendError(error, request, reply); }
  });

  app.get("/api/v1/shop/export.csv", async (request, reply) => {
    try {
      await authorizeShop(request, auth);
      const content = buildShopCsv((await shop.workspace()).items);
      return reply.header("Content-Disposition", `attachment; filename="varelager-${fileTimestamp()}.csv"`).type("text/csv; charset=UTF-8").send(content);
    } catch (error) { return sendError(error, request, reply); }
  });

  app.get("/api/v1/shop/export.pdf", async (request, reply) => {
    try {
      await authorizeShop(request, auth);
      const content = buildShopPdf((await shop.workspace()).items);
      return reply.header("Content-Disposition", `attachment; filename="varelager-${fileTimestamp()}.pdf"`).type("application/pdf").send(content);
    } catch (error) { return sendError(error, request, reply); }
  });

  app.get("/api/v1/crew-clothing", async (request, reply) => {
    try { const user = await authorizeClothing(request, auth); return await clothing.workspace(user.roles.some((role) => CREW_CLOTHING_ADMIN_ROLES.has(role))); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/crew-clothing/lookup", async (request, reply) => {
    try { await authorizeClothing(request, auth); return await clothing.lookup(lookupSchema.parse(request.body).query); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/crew-clothing/inventory", async (request, reply) => {
    try { const user = await authorizeClothing(request, auth); return reply.code(201).send(await clothing.saveInventory(inventorySchema.parse(request.body), user.id)); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.patch("/api/v1/crew-clothing/inventory/:id", async (request, reply) => {
    try { const user = await authorizeClothing(request, auth); const { id } = idParamsSchema.parse(request.params); await clothing.updateInventory(id, inventorySchema.parse(request.body), user.id); return reply.code(204).send(); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.delete("/api/v1/crew-clothing/inventory/:id", async (request, reply) => {
    try { const user = await authorizeClothing(request, auth); const { id } = idParamsSchema.parse(request.params); await clothing.deleteInventory(id, user.id); return reply.code(204).send(); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.patch("/api/v1/crew-clothing/members/:id", async (request, reply) => {
    try { const user = await authorizeClothing(request, auth); const { id } = idParamsSchema.parse(request.params); await clothing.updateMember(id, memberSchema.parse(request.body), user.id); return reply.code(204).send(); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/crew-clothing/members/:id/delivery", async (request, reply) => {
    try { const user = await authorizeClothing(request, auth); const { id } = idParamsSchema.parse(request.params); const body = deliverySchema.parse(request.body); await clothing.setDelivered(id, body.itemTypes, body.delivered, user.id); return reply.code(204).send(); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/crew-clothing/crews", async (request, reply) => {
    try { const user = await authorizeClothingAdmin(request, auth); return reply.code(201).send(await clothing.createCrew(crewSchema.parse(request.body), user.id)); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.patch("/api/v1/crew-clothing/crews/:id", async (request, reply) => {
    try { const user = await authorizeClothingAdmin(request, auth); const { id } = idParamsSchema.parse(request.params); await clothing.updateCrew(id, crewSchema.parse(request.body), user.id); return reply.code(204).send(); }
    catch (error) { return sendError(error, request, reply); }
  });
}

function authorizeShop(request: FastifyRequest, auth: AuthService) { return requireRoleAccess(request, auth, SHOP_ROLES, "Du har ikke tilgang til shop."); }
function authorizeClothing(request: FastifyRequest, auth: AuthService) { return requireRoleAccess(request, auth, CREW_CLOTHING_ROLES, "Du har ikke tilgang til crewtøy."); }
function authorizeClothingAdmin(request: FastifyRequest, auth: AuthService) { return requireRoleAccess(request, auth, CREW_CLOTHING_ADMIN_ROLES, "Bare V1-adminrollene kan administrere crew."); }

function sendError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  let statusCode = 500; let code = "INTERNAL_ERROR"; let message = "En intern feil oppstod.";
  if (error instanceof AuthenticationError) { statusCode = error.statusCode; code = authenticationErrorCode(error); message = error.message; }
  else if (error instanceof ShopDomainError || error instanceof CrewClothingDomainError) { statusCode = error.code === "NOT_FOUND" ? 404 : 409; code = error.code; message = error.message; }
  else if (error instanceof z.ZodError) { statusCode = 400; code = "INVALID_BODY"; message = error.issues[0]?.message ?? "Ugyldige data."; }
  else if (error instanceof Error && "code" in error && error.code === "FST_REQ_FILE_TOO_LARGE") { statusCode = 413; code = "FILE_TOO_LARGE"; message = "Importfilen er større enn 10 MB."; }
  const body: ApiError = { error: { code, message, requestId: request.id } };
  return reply.code(statusCode).send(body);
}

function fileTimestamp(): string { return new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15); }
