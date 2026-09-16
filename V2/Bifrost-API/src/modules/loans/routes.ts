import type { ApiError } from "@bifrost/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticationErrorCode, LOGISTICS_ROLES, requireRoleAccess } from "../../http/authorization.js";
import { AuthenticationError, type AuthService } from "../auth/service.js";
import { LoanDomainError, type LoanService } from "./service.js";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(150).optional(),
});
const issueSchema = z.object({
  wannabeId: z.coerce.number().int().min(1),
  lines: z.array(z.object({
    barcode: z.string().trim().min(1).max(150),
    quantity: z.coerce.number().int().min(1).max(1_000_000),
  })).min(1).max(50),
});
const returnSchema = z.object({ quantity: z.coerce.number().int().min(1).max(1_000_000) });
const idSchema = z.coerce.number().int().min(1);

export async function registerLoanRoutes(app: FastifyInstance, auth: AuthService, loans: LoanService): Promise<void> {
  app.get("/api/v1/loans", async (request, reply) => {
    try {
      await requireRoleAccess(request, auth, LOGISTICS_ROLES, "Du har ikke tilgang til utlån.");
      return loans.listActive(querySchema.parse(request.query));
    } catch (error) { return sendError(error, request, reply, "INVALID_QUERY"); }
  });

  app.post("/api/v1/loans", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, LOGISTICS_ROLES, "Du har ikke tilgang til utlån.");
      return reply.code(201).send(await loans.issue(issueSchema.parse(request.body), user.id));
    } catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/loans/:id/return", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, LOGISTICS_ROLES, "Du har ikke tilgang til utlån.");
      const id = idSchema.parse((request.params as { id?: unknown }).id);
      const body = returnSchema.parse(request.body);
      return await loans.returnLoan(id, body.quantity, user.id);
    } catch (error) { return sendError(error, request, reply); }
  });
}

function sendError(error: unknown, request: FastifyRequest, reply: FastifyReply, validationCode = "INVALID_BODY") {
  let statusCode = 500; let code = "INTERNAL_ERROR"; let message = "En intern feil oppstod.";
  if (error instanceof AuthenticationError) { statusCode = error.statusCode; code = authenticationErrorCode(error); message = error.message; }
  else if (error instanceof LoanDomainError) { statusCode = error.code === "NOT_FOUND" ? 404 : 409; code = error.code; message = error.message; }
  else if (error instanceof z.ZodError) { statusCode = 400; code = validationCode; message = validationCode === "INVALID_QUERY" ? "Ugyldig søk eller paginering." : "Ugyldige lånedata."; }
  const body: ApiError = { error: { code, message, requestId: request.id } };
  return reply.code(statusCode).send(body);
}
