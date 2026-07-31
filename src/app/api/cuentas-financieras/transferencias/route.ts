import { createClient } from "@/supabase/server";
import type { CrearTransferenciaFinancieraResponse } from "@/model/finanzas";
import {
  asRows,
  extractRpcId,
  mapTransferencia,
  rpcStatus,
  validateCreateTransferencia,
} from "../finanzasRouteUtils";

function firstTransferencia(data: unknown) {
  return mapTransferencia(asRows(data)[0]);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies CrearTransferenciaFinancieraResponse, { status: 401 });
  }

  const parsed = validateCreateTransferencia(await req.json().catch(() => null));
  if (parsed.error || !parsed.value) {
    return Response.json({ data: null, error: parsed.error ?? "JSON inválido" } satisfies CrearTransferenciaFinancieraResponse, { status: 400 });
  }

  const input = parsed.value;
  const { data: created, error: createError } = await supabase.rpc("rpc_finanzas_transferir", {
    p_cuenta_origen_id: input.cuentaOrigenId,
    p_cuenta_destino_id: input.cuentaDestinoId,
    p_importe: input.importe,
    p_fecha: input.fecha ?? null,
    p_descripcion: input.descripcion ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
  });
  if (createError) {
    return Response.json(
      { data: null, error: "Error registrando transferencia" } satisfies CrearTransferenciaFinancieraResponse,
      { status: rpcStatus(createError) }
    );
  }

  const inlineTransferencia = firstTransferencia(created);
  if (inlineTransferencia) {
    return Response.json({ data: inlineTransferencia, error: null } satisfies CrearTransferenciaFinancieraResponse, { status: 201 });
  }

  const id = extractRpcId(created);
  if (!id) {
    return Response.json(
      { data: null, error: "Respuesta inválida al registrar transferencia" } satisfies CrearTransferenciaFinancieraResponse,
      { status: 500 }
    );
  }
  const { data: fetched, error: fetchError } = await supabase.rpc("rpc_finanzas_obtener_transferencia", {
    p_transferencia_id: id,
  });
  const transferencia = firstTransferencia(fetched);
  if (fetchError || !transferencia) {
    return Response.json(
      { data: null, error: "No se pudo recuperar la transferencia registrada" } satisfies CrearTransferenciaFinancieraResponse,
      { status: fetchError ? rpcStatus(fetchError) : 500 }
    );
  }
  return Response.json({ data: transferencia, error: null } satisfies CrearTransferenciaFinancieraResponse, { status: 201 });
}
