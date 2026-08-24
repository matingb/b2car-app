import { createClient } from "@/supabase/server";
import { logger } from "@/lib/logger";
import type { CrearTransferenciaFinancieraResponse, TransferenciaFinanciera } from "@/model/finanzas";
import {
  extractRpcId,
  rpcStatus,
  validateCreateTransferencia,
} from "../finanzasRouteUtils";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    logger.warn("[POST /api/cuentas-financieras/transferencias] Petición no autorizada: sin sesión activa");
    return Response.json({ data: null, error: "Unauthorized" } satisfies CrearTransferenciaFinancieraResponse, { status: 401 });
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = validateCreateTransferencia(rawBody);
  if (parsed.error || !parsed.value) {
    logger.error("[POST /api/cuentas-financieras/transferencias] Error de validación del payload:", parsed.error, { rawBody });
    return Response.json({ data: null, error: parsed.error ?? "JSON inválido" } satisfies CrearTransferenciaFinancieraResponse, { status: 400 });
  }

  const input = parsed.value;
  logger.info("[POST /api/cuentas-financieras/transferencias] Ejecutando rpc_crear_movimiento_cuenta para transferencia:", {
    cuentaOrigenId: input.cuentaOrigenId,
    cuentaDestinoId: input.cuentaDestinoId,
    importe: input.importe,
    fecha: input.fecha,
  });

  const { data: created, error: createError } = await supabase.rpc("rpc_crear_movimiento_cuenta", {
    p_subtipo: "TRANSFERENCIA",
    p_importe: input.importe,
    p_cuenta_origen_id: input.cuentaOrigenId,
    p_cuenta_destino_id: input.cuentaDestinoId,
    p_descripcion: input.descripcion ?? null,
    p_fecha: input.fecha ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
  });
  if (createError) {
    logger.error("[POST /api/cuentas-financieras/transferencias] Error RPC en supabase.rpc('rpc_crear_movimiento_cuenta'):", createError, { input });
    return Response.json(
      { data: null, error: createError.message || "Error registrando transferencia" } satisfies CrearTransferenciaFinancieraResponse,
      { status: rpcStatus(createError) }
    );
  }

  const id = extractRpcId(created);
  if (!id) {
    logger.error("[POST /api/cuentas-financieras/transferencias] Respuesta inválida de RPC (id no encontrado):", created);
    return Response.json(
      { data: null, error: "Respuesta inválida al registrar transferencia" } satisfies CrearTransferenciaFinancieraResponse,
      { status: 500 }
    );
  }

  const result: TransferenciaFinanciera = {
    id,
    cuentaOrigenId: input.cuentaOrigenId,
    cuentaOrigenNombre: null,
    cuentaDestinoId: input.cuentaDestinoId,
    cuentaDestinoNombre: null,
    importe: input.importe,
    fecha: input.fecha ?? new Date().toISOString(),
    descripcion: input.descripcion ?? null,
    reversaMovimientoId: null,
    createdAt: new Date().toISOString(),
  };

  logger.info("[POST /api/cuentas-financieras/transferencias] Transferencia creada exitosamente con ID:", id);
  return Response.json({ data: result, error: null } satisfies CrearTransferenciaFinancieraResponse, { status: 201 });
}

