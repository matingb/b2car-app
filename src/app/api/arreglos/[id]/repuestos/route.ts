import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";

export type UpsertRepuestoLineaRequest = {
  taller_id: string;
  producto_id: string;
  cantidad: number;
  monto_unitario: number;
};

export type UpsertRepuestoLineaResponse = {
  data: { operacion_id: string } | null;
  error?: string | null;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id: arregloId } = await params;

  const body: UpsertRepuestoLineaRequest | null = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ data: null, error: "JSON inválido" } satisfies UpsertRepuestoLineaResponse, { status: 400 });
  }

  const tallerId = String(body.taller_id ?? "").trim();
  const productoId = String(body.producto_id ?? "").trim();
  const cantidad = Number(body.cantidad);
  const montoUnitario = Number(body.monto_unitario);

  if (!arregloId) {
    return Response.json({ data: null, error: "Falta arreglo_id" } satisfies UpsertRepuestoLineaResponse, { status: 400 });
  }
  if (!tallerId) {
    return Response.json({ data: null, error: "Falta taller_id" } satisfies UpsertRepuestoLineaResponse, { status: 400 });
  }
  if (!productoId) {
    return Response.json({ data: null, error: "Falta producto_id" } satisfies UpsertRepuestoLineaResponse, { status: 400 });
  }
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return Response.json({ data: null, error: "Cantidad inválida" } satisfies UpsertRepuestoLineaResponse, { status: 400 });
  }
  if (!Number.isFinite(montoUnitario) || montoUnitario < 0) {
    return Response.json({ data: null, error: "Monto unitario inválido" } satisfies UpsertRepuestoLineaResponse, { status: 400 });
  }

  const { data, error } = await supabase.rpc("rpc_set_asignacion_arreglo_linea", {
    p_arreglo_id: arregloId,
    p_taller_id: tallerId,
    p_producto_id: productoId,
    p_cantidad: cantidad,
    p_monto_unitario: montoUnitario,
  });

  if (error || !data) {
    const raw = String(error?.message ?? "");
    const isStock = raw.includes("STOCK_INSUFICIENTE");
    const status = isStock ? 409 : 500;
    const message = isStock ? "Stock insuficiente" : "Error guardando repuesto";
    return Response.json({ data: null, error: message } satisfies UpsertRepuestoLineaResponse, { status });
  }

  return Response.json({ data: { operacion_id: String(data) }, error: null } satisfies UpsertRepuestoLineaResponse, { status: 200 });
}

