import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";

export type UpsertRepuestoLineaRequest = {
  tipo?: "existente";
  taller_id: string;
  stock_id: string;
  cantidad: number;
  monto_unitario: number;
  precio_compra?: number | null;
};

export type CreateInlineProductoRepuestoRequest = {
  tipo: "nuevo";
  taller_id: string;
  codigo: string;
  nombre: string;
  precio_compra: number;
  precio_venta: number;
  cantidad: number;
};

export type UpsertRepuestoRequest =
  | UpsertRepuestoLineaRequest
  | CreateInlineProductoRepuestoRequest;

export type UpsertRepuestoLineaResponse = {
  data: { operacion_id: string } | null;
  error?: string | null;
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function mapInlineRpcError(error: unknown): { status: number; message: string } {
  const raw = String((error as { message?: unknown } | null)?.message ?? "");
  if (raw.includes("PRODUCTO_CODIGO_DUPLICADO") || raw.includes("uq_productos_tenant_codigo")) {
    return {
      status: 409,
      message: "Ya existe un producto con ese codigo. Seleccionalo desde el listado.",
    };
  }
  if (raw.includes("STOCK_INSUFICIENTE")) {
    return { status: 409, message: "Stock insuficiente" };
  }
  return { status: 500, message: "No se pudieron guardar los repuestos." };
}

function mapExistingRepuestoRpcError(error: unknown): { status: number; message: string } {
  const raw = String((error as { message?: unknown } | null)?.message ?? "");

  if (raw.includes("PRECIO_COMPRA_REQUERIDO")) {
    return { status: 400, message: "Precio de compra requerido para cubrir stock faltante" };
  }
  if (raw.includes("STOCK_INSUFICIENTE")) {
    return { status: 409, message: "Stock insuficiente" };
  }

  return { status: 500, message: "Error guardando repuesto" };
}

async function upsertRepuestoExistente(
  supabase: SupabaseClient,
  arregloId: string,
  body: UpsertRepuestoLineaRequest
) {
  const tallerId = String(body.taller_id ?? "").trim();
  const stockId = String(body.stock_id ?? "").trim();
  const cantidad = Number(body.cantidad);
  const montoUnitario = Number(body.monto_unitario);

  if (!arregloId) {
    return Response.json({ data: null, error: "Falta arreglo_id" } satisfies UpsertRepuestoLineaResponse, { status: 400 });
  }
  if (!tallerId) {
    return Response.json({ data: null, error: "Falta taller_id" } satisfies UpsertRepuestoLineaResponse, { status: 400 });
  }
  if (!stockId) {
    return Response.json({ data: null, error: "Falta stock_id" } satisfies UpsertRepuestoLineaResponse, { status: 400 });
  }
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return Response.json({ data: null, error: "Cantidad invalida" } satisfies UpsertRepuestoLineaResponse, { status: 400 });
  }
  if (!Number.isFinite(montoUnitario) || montoUnitario < 0) {
    return Response.json({ data: null, error: "Monto unitario invalido" } satisfies UpsertRepuestoLineaResponse, { status: 400 });
  }

  const precioCompraRaw = body.precio_compra;
  const precioCompra =
    precioCompraRaw == null || precioCompraRaw === ("" as unknown) ? null : Number(precioCompraRaw);
  if (precioCompra != null && (!Number.isFinite(precioCompra) || precioCompra < 0)) {
    return Response.json({ data: null, error: "Precio de compra invalido" } satisfies UpsertRepuestoLineaResponse, { status: 400 });
  }

  const { data, error } = await supabase.rpc("rpc_asignar_repuesto_existente_con_compra", {
    p_arreglo_id: arregloId,
    p_taller_id: tallerId,
    p_stock_id: stockId,
    p_cantidad: cantidad,
    p_monto_unitario: montoUnitario,
    p_precio_compra: precioCompra,
  });

  if (error || !data) {
    const mapped = mapExistingRepuestoRpcError(error);
    return Response.json({ data: null, error: mapped.message } satisfies UpsertRepuestoLineaResponse, { status: mapped.status });
  }

  return Response.json({ data: { operacion_id: String(data) }, error: null } satisfies UpsertRepuestoLineaResponse, { status: 200 });
}

async function createRepuestoConProductoNuevo(
  supabase: SupabaseClient,
  arregloId: string,
  body: CreateInlineProductoRepuestoRequest
) {
  const tallerId = String(body.taller_id ?? "").trim();
  const codigo = String(body.codigo ?? "").trim();
  const nombre = String(body.nombre ?? "").trim();
  const precioCompra = Number(body.precio_compra);
  const precioVenta = Number(body.precio_venta);
  const cantidad = Number(body.cantidad);

  if (!arregloId) return Response.json({ data: null, error: "Falta arreglo_id" } satisfies UpsertRepuestoLineaResponse, { status: 400 });
  if (!tallerId) return Response.json({ data: null, error: "Falta taller_id" } satisfies UpsertRepuestoLineaResponse, { status: 400 });
  if (!codigo) return Response.json({ data: null, error: "Falta codigo" } satisfies UpsertRepuestoLineaResponse, { status: 400 });
  if (!nombre) return Response.json({ data: null, error: "Falta nombre" } satisfies UpsertRepuestoLineaResponse, { status: 400 });
  if (!Number.isFinite(precioCompra) || precioCompra < 0) {
    return Response.json({ data: null, error: "Precio de compra invalido" } satisfies UpsertRepuestoLineaResponse, { status: 400 });
  }
  if (!Number.isFinite(precioVenta) || precioVenta < 0) {
    return Response.json({ data: null, error: "Precio de venta invalido" } satisfies UpsertRepuestoLineaResponse, { status: 400 });
  }
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return Response.json({ data: null, error: "Cantidad invalida" } satisfies UpsertRepuestoLineaResponse, { status: 400 });
  }

  const { data, error } = await supabase.rpc("rpc_crear_producto_inline_para_arreglo", {
    p_arreglo_id: arregloId,
    p_taller_id: tallerId,
    p_codigo: codigo,
    p_nombre: nombre,
    p_precio_compra: precioCompra,
    p_precio_venta: precioVenta,
    p_cantidad: cantidad,
  });

  if (error || !data) {
    const mapped = mapInlineRpcError(error);
    return Response.json({ data: null, error: mapped.message } satisfies UpsertRepuestoLineaResponse, { status: mapped.status });
  }

  return Response.json({ data: { operacion_id: String(data) }, error: null } satisfies UpsertRepuestoLineaResponse, { status: 200 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id: arregloId } = await params;

  const body: UpsertRepuestoRequest | null = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ data: null, error: "JSON invalido" } satisfies UpsertRepuestoLineaResponse, { status: 400 });
  }

  if (body.tipo === "nuevo") {
    return createRepuestoConProductoNuevo(supabase, arregloId, body);
  }

  return upsertRepuestoExistente(supabase, arregloId, body);
}
