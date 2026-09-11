import {
  ArcaInscriptionLookupError,
  lookupArcaInscriptionVatCondition,
} from "@/lib/arcaInscripcion/arcaInscripcionGateway";
import { FacturacionHttpError, requireTenantActor } from "@/lib/facturacion/serverAuth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function statusFor(error: ArcaInscriptionLookupError): number {
  switch (error.code) {
    case "ARCA_INSCRIPTION_INVALID_CUIT": return 422;
    case "ARCA_INSCRIPTION_NOT_FOUND": return 404;
    case "ARCA_INSCRIPTION_NOT_CONFIGURED":
    case "ARCA_INSCRIPTION_UNAVAILABLE": return 503;
  }
}

export async function GET(request: Request) {
  try {
    await requireTenantActor();
    const cuit = new URL(request.url).searchParams.get("cuit") ?? "";
    const data = await lookupArcaInscriptionVatCondition(cuit);
    return Response.json(
      { data, error: null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof FacturacionHttpError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ArcaInscriptionLookupError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: statusFor(error), headers: { "Cache-Control": "private, no-store" } },
      );
    }
    logger.error("Error al consultar condición IVA en Constancia de Inscripción ARCA", error);
    return Response.json(
      { error: "No se pudo verificar la condición IVA en ARCA" },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
