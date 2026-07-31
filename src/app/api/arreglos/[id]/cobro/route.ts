import type { NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import { isValidUuid } from "@/lib/uuid";
import type { Arreglo } from "@/model/types";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";

type CobroRequest = {
  cuenta_financiera_id?: unknown;
  fecha_cobro?: unknown;
  idempotency_key?: unknown;
};

type CobroResponse = {
  data: Arreglo | null;
  error?: string | null;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string) {
  if (!DATE_ONLY.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

async function fetchArreglo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<{ data: Arreglo | null; error: string | null }> {
  const { data, error } = await supabase.from("arreglos").select("*").eq("id", id).maybeSingle();
  if (error) return { data: null, error: "No se pudo recuperar el arreglo" };
  if (!data) return { data: null, error: "Arreglo no encontrado" };
  return { data: data as Arreglo, error: null };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { id } = await params;
  const body: CobroRequest | null = await req.json().catch(() => null);

  if (!isValidUuid(id)) {
    return Response.json({ data: null, error: "arreglo_id invÃ¡lido" } satisfies CobroResponse, { status: 400 });
  }
  const cuentaId = typeof body?.cuenta_financiera_id === "string" ? body.cuenta_financiera_id : "";
  const fechaCobro = typeof body?.fecha_cobro === "string" ? body.fecha_cobro : "";
  const idempotencyKey = typeof body?.idempotency_key === "string" ? body.idempotency_key : "";
  if (!isValidUuid(cuentaId)) {
    return Response.json({ data: null, error: "cuenta_financiera_id invÃ¡lida" } satisfies CobroResponse, { status: 400 });
  }
  if (!isValidDate(fechaCobro)) {
    return Response.json({ data: null, error: "fecha_cobro invÃ¡lida" } satisfies CobroResponse, { status: 400 });
  }
  if (!isValidUuid(idempotencyKey)) {
    return Response.json({ data: null, error: "idempotency_key invÃ¡lida" } satisfies CobroResponse, { status: 400 });
  }

  const { error: rpcError } = await supabase.rpc("rpc_finanzas_cobrar_arreglo", {
    p_arreglo_id: id,
    p_cuenta_id: cuentaId,
    p_fecha_cobro: fechaCobro,
    p_idempotency_key: idempotencyKey,
  });
  if (rpcError) {
    return Response.json({ data: null, error: rpcError.message || "No se pudo registrar el cobro" } satisfies CobroResponse, { status: 400 });
  }

  const result = await fetchArreglo(supabase, id);
  if (result.error || !result.data) {
    return Response.json({ data: null, error: result.error ?? "No se pudo recuperar el arreglo" } satisfies CobroResponse, { status: result.error === "Arreglo no encontrado" ? 404 : 500 });
  }
  await statsService.onDataChanged(supabase, (result.data as { tenant_id?: string | null }).tenant_id);
  return Response.json({ data: result.data, error: null } satisfies CobroResponse, { status: 200 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { id } = await params;
  const idempotencyKey = req.headers.get("x-idempotency-key")?.trim() ?? "";

  if (!isValidUuid(id)) {
    return Response.json({ data: null, error: "arreglo_id invÃ¡lido" } satisfies CobroResponse, { status: 400 });
  }
  if (!isValidUuid(idempotencyKey)) {
    return Response.json({ data: null, error: "X-Idempotency-Key invÃ¡lida" } satisfies CobroResponse, { status: 400 });
  }

  const { error: rpcError } = await supabase.rpc("rpc_finanzas_anular_cobro_arreglo", {
    p_arreglo_id: id,
    p_idempotency_key: idempotencyKey,
  });
  if (rpcError) {
    return Response.json({ data: null, error: rpcError.message || "No se pudo anular el cobro" } satisfies CobroResponse, { status: 400 });
  }

  const result = await fetchArreglo(supabase, id);
  if (result.error || !result.data) {
    return Response.json({ data: null, error: result.error ?? "No se pudo recuperar el arreglo" } satisfies CobroResponse, { status: result.error === "Arreglo no encontrado" ? 404 : 500 });
  }
  await statsService.onDataChanged(supabase, (result.data as { tenant_id?: string | null }).tenant_id);
  return Response.json({ data: result.data, error: null } satisfies CobroResponse, { status: 200 });
}
