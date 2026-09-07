import { generateArcaCredentialArchive } from "@/lib/facturacion/arcaCredentialRequest";
import { FacturacionValidationError } from "@/lib/facturacion/arcaPayload";
import { facturacionErrorResponse, requireTenantAdmin } from "@/lib/facturacion/serverAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireTenantAdmin();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new FacturacionValidationError("Los datos para generar la clave no son válidos");
    }
    const input = body as Record<string, unknown>;
    if (
      typeof input.organizationName !== "string"
      || typeof input.systemName !== "string"
      || typeof input.cuit !== "string"
    ) {
      throw new FacturacionValidationError("Faltan datos para generar la clave y la solicitud de certificado");
    }

    const result = generateArcaCredentialArchive({
      organizationName: input.organizationName,
      systemName: input.systemName,
      cuit: input.cuit,
    });
    const archive = new ArrayBuffer(result.archive.byteLength);
    new Uint8Array(archive).set(result.archive);
    return new Response(archive, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${result.archiveFilename}"`,
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return facturacionErrorResponse(error);
  }
}
