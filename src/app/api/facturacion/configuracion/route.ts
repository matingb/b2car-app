import {
  getFacturacionConfig,
  saveFacturacionConfig,
  FacturacionValidationError,
} from "@/lib/facturacion/facturacionService";
import { facturacionErrorResponse, requireTenantAdmin } from "@/lib/facturacion/serverAuth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = await requireTenantAdmin();
    const config = await getFacturacionConfig(actor.tenantId);
    return Response.json({ data: config, error: null });
  } catch (error) {
    return facturacionErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requireTenantAdmin();
    const formData = await request.formData().catch(() => null);
    if (!formData) throw new FacturacionValidationError("El formulario de configuración no es válido");
    const configValue = formData.get("config");
    if (typeof configValue !== "string") {
      throw new FacturacionValidationError("Falta el campo JSON de configuración");
    }
    let input: unknown;
    try {
      input = JSON.parse(configValue);
    } catch {
      throw new FacturacionValidationError("El campo JSON de configuración no es válido");
    }
    const certificateValue = formData.get("certificate");
    const privateKeyValue = formData.get("privateKey");
    if (typeof certificateValue === "string" || typeof privateKeyValue === "string") {
      throw new FacturacionValidationError("Los campos de credenciales deben ser archivos");
    }
    const config = await saveFacturacionConfig(
      actor.tenantId,
      actor.userId,
      input,
      certificateValue ?? undefined,
      privateKeyValue ?? undefined,
    );
    return Response.json({ data: config, error: null });
  } catch (error) {
    if (error instanceof FacturacionValidationError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    return facturacionErrorResponse(error);
  }
}
