import { BIFROST_ACCESS, type ApiError } from "@bifrost/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticationErrorCode, requireRoleAccess } from "../../http/authorization.js";
import { AuthenticationError, type AuthService } from "../auth/service.js";
import { BarcodeDomainError, type BarcodeService } from "./service.js";

const exportSchema = z.object({
  filename: z.string().max(180).optional(),
  rangeStart: z.string().max(150).optional(),
  rangeEnd: z.string().max(150).optional(),
  codes: z.string().max(1_000_000).optional(),
});

export async function registerBarcodeRoutes(app: FastifyInstance, auth: AuthService, barcodes: BarcodeService): Promise<void> {
  app.post("/api/v1/barcodes/export", async (request, reply) => {
    try {
      await requireRoleAccess(request, auth, BIFROST_ACCESS.barcodeExport, "Du har ikke tilgang til strekkodeeksport.");
      const result = barcodes.buildExport(exportSchema.parse(request.body));
      return reply
        .type(result.mime)
        .header("Content-Disposition", `attachment; filename="${result.filename}"`)
        .header("X-Barcode-Count", String(result.count))
        .send(result.content);
    } catch (error) {
      return sendError(error, request, reply);
    }
  });
}

function sendError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  let statusCode = 500; let code = "INTERNAL_ERROR"; let message = "En intern feil oppstod.";
  if (error instanceof AuthenticationError) { statusCode = error.statusCode; code = authenticationErrorCode(error); message = error.message; }
  else if (error instanceof BarcodeDomainError) { statusCode = error.code === "TOO_MANY_CODES" ? 413 : 400; code = error.code; message = error.message; }
  else if (error instanceof z.ZodError) { statusCode = 400; code = "INVALID_BODY"; message = error.issues[0]?.message ?? "Ugyldige data."; }
  const body: ApiError = { error: { code, message, requestId: request.id } };
  return reply.code(statusCode).send(body);
}
