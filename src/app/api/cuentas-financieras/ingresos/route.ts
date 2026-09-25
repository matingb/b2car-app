import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { logger } from "@/lib/logger";
import { requirePermission } from "@/lib/requirePermission";
import { Permission } from "@/lib/permissions";
import type { CrearIngresoManualResponse, IngresoManualFinanciero } from "@/model/finanzas";
import { createClient } from "@/supabase/server";
import { extractRpcId, rpcErrorMessage, rpcStatus, validateCreateIngresoManual } from "../finanzasRouteUtils";

export async function POST(req: Request) {
  const authError = await requirePermission(Permission.FinanzasEdit);
  if (authError) return authError;

  const supabase = await createClient();
  const parsed = validateCreateIngresoManual(await req.json().catch(() => null));
  if (parsed.error || !parsed.value) {
    return Response.json(
      { data: null, error: parsed.error ?? "JSON inválido" } satisfies CrearIngresoManualResponse,
      { status: 400 }
    );
  }

  const input = parsed.value;
  const { data: created, error: createError } = await supabase.rpc("rpc_crear_movimiento_cuenta", {
    p_subtipo: "INGRESO",
    p_cuenta_id: input.cuentaId,
    p_importe: input.importe,
    p_fecha: input.fecha,
    p_descripcion: input.descripcion,
    p_idempotency_key: input.idempotencyKey ?? null,
  });
  if (createError) {
    logger.error("Error registrando ingreso manual", { code: createError.code });
    return Response.json(
      {
        data: null,
        error: rpcErrorMessage(createError, "No se pudo registrar el ingreso manual"),
      } satisfies CrearIngresoManualResponse,
      { status: rpcStatus(createError) }
    );
  }

  await statsService.onDataChanged(supabase);

  const id = extractRpcId(created);
  if (!id) {
    logger.error("Respuesta inválida de RPC al registrar ingreso manual");
    return Response.json(
      { data: null, error: "Respuesta inválida al registrar ingreso manual" } satisfies CrearIngresoManualResponse,
      { status: 500 }
    );
  }

  const result: IngresoManualFinanciero = {
    id,
    cuentaId: input.cuentaId,
    importe: input.importe,
    fecha: input.fecha,
    descripcion: input.descripcion,
    createdAt: new Date().toISOString(),
  };
  return Response.json({ data: result, error: null } satisfies CrearIngresoManualResponse, { status: 201 });
}
