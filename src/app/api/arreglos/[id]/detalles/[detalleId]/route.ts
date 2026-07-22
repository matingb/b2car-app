import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";
import { detalleArregloService } from "@/app/api/arreglos/detalleArregloService";
import { ServiceError } from "@/app/api/serviceError";
import { syncArregloDescripcion } from "@/app/api/arreglos/arregloDescripcionService";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { isValidUuid } from "@/lib/uuid";

export type UpdateDetalleArregloRequest = Partial<{
  descripcion: string;
  cantidad: number;
  valor: number;
  tipo_arreglo_id: string | null;
  empleado_id: string | null;
}>;

export type DetalleArregloResponseRow = {
  id: string;
  arreglo_id: string;
  descripcion: string;
  cantidad: number;
  valor: number;
  tipo_arreglo_id: string | null;
  empleado_id: string | null;
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

  if (body.tipo_arreglo_id !== undefined) {
    if (body.tipo_arreglo_id !== null && !isValidUuid(body.tipo_arreglo_id)) {
      return Response.json({ data: null, error: "tipo_arreglo_id inválido" } satisfies UpdateDetalleArregloResponse, { status: 400 });
    }
    patch.tipo_arreglo_id = body.tipo_arreglo_id;
  }

  if (body.empleado_id !== undefined) {
    if (body.empleado_id !== null && !isValidUuid(body.empleado_id)) {
      return Response.json({ data: null, error: "empleado_id inválido" } satisfies UpdateDetalleArregloResponse, { status: 400 });
    }
    patch.empleado_id = body.empleado_id;
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

  const { data, error } = await detalleArregloService.updateById(supabase, arregloId, detalleId, patch);

  if (error || !data) {
    const status = error === ServiceError.NotFound ? 404 : 500;
    const message = status === 404 ? "Detalle no encontrado" : "Error actualizando detalle del arreglo";
    return Response.json({ data: null, error: message } satisfies UpdateDetalleArregloResponse, { status });
  }

  const { error: syncError } = await syncArregloDescripcion(supabase, arregloId);
  if (syncError) {
    const status = syncError === ServiceError.NotFound ? 404 : 500;
    const message = "Error actualizando la descripción del arreglo";
    return Response.json({ data: null, error: message } satisfies UpdateDetalleArregloResponse, { status });
  }

  await statsService.onDataChanged(supabase);

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

  const { error } = await detalleArregloService.deleteById(supabase, arregloId, detalleId);
  if (error) {
    const status = error === ServiceError.NotFound ? 404 : 500;
    const message = status === 404 ? "Detalle no encontrado" : "Error eliminando detalle del arreglo";
    return Response.json({ error: message } satisfies DeleteDetalleArregloResponse, { status });
  }

  const { error: syncError } = await syncArregloDescripcion(supabase, arregloId);
  if (syncError) {
    const status = syncError === ServiceError.NotFound ? 404 : 500;
    const message = "Error actualizando la descripción del arreglo";
    return Response.json({ error: message } satisfies DeleteDetalleArregloResponse, { status });
  }

  await statsService.onDataChanged(supabase);

  return Response.json({ error: null } satisfies DeleteDetalleArregloResponse, { status: 200 });
}
