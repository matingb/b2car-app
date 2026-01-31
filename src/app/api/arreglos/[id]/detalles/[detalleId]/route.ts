import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";

export type UpdateDetalleArregloRequest = Partial<{
  descripcion: string;
  cantidad: number;
  valor: number;
}>;

export type DetalleArregloResponseRow = {
  id: string;
  arreglo_id: string;
  descripcion: string;
  cantidad: number;
  valor: number;
  created_at: string;
  updated_at: string;
};

export type UpdateDetalleArregloResponse = {
  data: DetalleArregloResponseRow | null;
  error?: string | null;
};

export type DeleteDetalleArregloResponse = {
  error?: string | null;
};

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; detalleId: string }> }
) {
  const supabase = await createClient();
  const { id: arregloId, detalleId } = await params;

  const body: UpdateDetalleArregloRequest | null = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ data: null, error: "JSON inválido" } satisfies UpdateDetalleArregloResponse, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (body.descripcion !== undefined) {
    const descripcion = String(body.descripcion ?? "").trim();
    if (!descripcion) {
      return Response.json({ data: null, error: "Descripción inválida" } satisfies UpdateDetalleArregloResponse, { status: 400 });
    }
    patch.descripcion = descripcion;
  }

  if (body.cantidad !== undefined) {
    const cantidad = Number(body.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return Response.json({ data: null, error: "Cantidad inválida" } satisfies UpdateDetalleArregloResponse, { status: 400 });
    }
    patch.cantidad = cantidad;
  }

  if (body.valor !== undefined) {
    const valor = Number(body.valor);
    if (!Number.isFinite(valor) || valor < 0) {
      return Response.json({ data: null, error: "Valor inválido" } satisfies UpdateDetalleArregloResponse, { status: 400 });
    }
    patch.valor = valor;
  }

  if (!arregloId) {
    return Response.json({ data: null, error: "Falta arreglo_id" } satisfies UpdateDetalleArregloResponse, { status: 400 });
  }
  if (!detalleId) {
    return Response.json({ data: null, error: "Falta detalleId" } satisfies UpdateDetalleArregloResponse, { status: 400 });
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ data: null, error: "No hay cambios" } satisfies UpdateDetalleArregloResponse, { status: 400 });
  }

  const { data, error } = await supabase
    .from("detalle_arreglo")
    .update(patch)
    .eq("id", detalleId)
    .eq("arreglo_id", arregloId)
    .select("id, arreglo_id, descripcion, cantidad, valor, created_at, updated_at")
    .single();

  if (error || !data) {
    const status = (error as { code?: string } | null)?.code === "PGRST116" ? 404 : 500;
    const message = status === 404 ? "Detalle no encontrado" : "Error actualizando detalle del arreglo";
    return Response.json({ data: null, error: message } satisfies UpdateDetalleArregloResponse, { status });
  }

  return Response.json({ data, error: null } satisfies UpdateDetalleArregloResponse, { status: 200 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; detalleId: string }> }
) {
  const supabase = await createClient();
  const { id: arregloId, detalleId } = await params;

  if (!arregloId) {
    return Response.json({ error: "Falta arreglo_id" } satisfies DeleteDetalleArregloResponse, { status: 400 });
  }
  if (!detalleId) {
    return Response.json({ error: "Falta detalleId" } satisfies DeleteDetalleArregloResponse, { status: 400 });
  }

  const { data, error } = await supabase
    .from("detalle_arreglo")
    .delete()
    .eq("id", detalleId)
    .eq("arreglo_id", arregloId)
    .select("id")
    .maybeSingle();

  if (error) {
    return Response.json({ error: "Error eliminando detalle del arreglo" } satisfies DeleteDetalleArregloResponse, { status: 500 });
  }

  if (!data?.id) {
    return Response.json({ error: "Detalle no encontrado" } satisfies DeleteDetalleArregloResponse, { status: 404 });
  }

  return Response.json({ error: null } satisfies DeleteDetalleArregloResponse, { status: 200 });
}

