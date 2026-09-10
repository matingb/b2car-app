import {
  ArcaPadronLookupError,
  lookupArcaPadronPerson,
} from "@/lib/arcaPadron/arcaPadronGateway";
import { FacturacionHttpError, requireTenantActor } from "@/lib/facturacion/serverAuth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseDocumentType(value: string | null): 80 | 86 | 96 {
  if (value === "80" || value === "86" || value === "96") return Number(value) as 80 | 86 | 96;
  throw new ArcaPadronLookupError("Elegí DNI, CUIL o CUIT para consultar el padrón de ARCA", "ARCA_PADRON_INVALID_DOCUMENT");
}

function statusFor(error: ArcaPadronLookupError): number {
  switch (error.code) {
    case "ARCA_PADRON_INVALID_DOCUMENT": return 422;
    case "ARCA_PADRON_NOT_FOUND": return 404;
    case "ARCA_PADRON_NOT_CONFIGURED":
    case "ARCA_PADRON_UNAVAILABLE": return 503;
  }
}

export async function GET(request: Request) {
  try {
    await requireTenantActor();
    const { searchParams } = new URL(request.url);
    const data = await lookupArcaPadronPerson(
      parseDocumentType(searchParams.get("tipoDocumento")),
      searchParams.get("numeroDocumento") ?? "",
    );
    return Response.json(
      { data, error: null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof FacturacionHttpError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ArcaPadronLookupError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: statusFor(error), headers: { "Cache-Control": "private, no-store" } },
      );
    }
    logger.error("Error al consultar el padrón ARCA", error);
    return Response.json(
      { error: "No se pudo consultar el padrón de ARCA" },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
