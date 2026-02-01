import { Arreglo } from "@/model/types";
import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { arregloService } from "@/app/api/arreglos/arregloService";
import type { UpdateArregloRequest } from "../arregloRequests";
import { ServiceError } from "../../serviceError";

export type DetalleArreglo = {
  id: string;
  arreglo_id: string;
  descripcion: string;
  cantidad: number;
  valor: number;
  created_at?: string;
  updated_at?: string;
};

export type AsignacionArregloProducto = {
  id: string;
  codigo: string;
  nombre: string;
  precio_unitario?: number;
  costo_unitario?: number;
  proveedor?: string | null;
  categorias?: string[];
};

export type AsignacionArregloLinea = {
  id: string;
  operacion_id: string;
  stock_id: string;
  cantidad: number;
  monto_unitario: number;
  delta_cantidad: number;
  created_at: string;
  producto?: AsignacionArregloProducto | null;
};

export type AsignacionArregloOperacion = {
  id: string;
  tipo: string;
  taller_id: string;
  created_at: string;
  lineas: AsignacionArregloLinea[];
};

export type ArregloDetalleData = {
  arreglo: Arreglo;
  detalles: DetalleArreglo[];
  asignaciones: AsignacionArregloOperacion[];
};

export type GetArregloByIdResponse = {
  data: ArregloDetalleData | null;
  error?: string | null;
};

export type UpdateArregloResponse = {
  data: Arreglo | null;
  error?: string | null;
};

// GET /api/arreglos/[id] -> obtener un arreglo + detalles (servicios) + asignaciones (repuestos)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "rpc_get_arreglo_detalle",
    { p_arreglo_id: id }
  );

  if (rpcError) {
    console.error("Error rpc_get_arreglo_detalle:", rpcError);
    const status = String((rpcError as unknown as { code?: unknown })?.code ?? "").includes("42501") ? 401 : 500;
    return Response.json(
      { data: null, error: "Error cargando arreglo" },
      { status }
    );
  }

  if (!rpcData) {
    return Response.json({ data: null, error: "Arreglo no encontrado" }, { status: 404 });
  }

  const rpc = rpcData as {
    arreglo?: unknown;
    detalles?: unknown;
    asignaciones?: unknown;
  };

  const arreglo = rpc.arreglo as Arreglo;
  const detalles = (Array.isArray(rpc.detalles) ? rpc.detalles : []) as DetalleArreglo[];
  const asignaciones = (Array.isArray(rpc.asignaciones) ? rpc.asignaciones : []) as AsignacionArregloOperacion[];

  const payload: ArregloDetalleData = {
    arreglo: arreglo as Arreglo,
    detalles,
    asignaciones,
  };

  return Response.json({ data: payload, error: null });
}

// PUT /api/arreglos/[id] -> actualizar arreglo (edición parcial)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const payload: UpdateArregloRequest | null = await req.json().catch(() => null);
  if (!payload) return Response.json({ error: "JSON inválido" }, { status: 400 });

  const { data, error } = await arregloService.updateById(
    supabase,
    id,
    payload
  );

  if (error) {
    const status = error === ServiceError.NotFound ? 404 : 500;
    const message = status === 404 ? "Arreglo no encontrado" : "Error actualizando arreglo";
    return Response.json({ data: null, error: message }, { status });
  }

  await statsService.onDataChanged(supabase);
  return Response.json({ data: data, error: null }, { status: 200 });
}

// DELETE /api/arreglos/[id] -> eliminar arreglo
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  if (!id)
    return Response.json({ error: "ID de arreglo no proporcionado" }, { status: 400 });

  const { error } = await arregloService.deleteById(supabase, id);

  if (error) {
    const status = error === ServiceError.NotFound ? 404 : 500;
    const message = status === 404 ? "Arreglo no encontrado" : "Error eliminando arreglo";
    return Response.json({ error: message }, { status });
  }

  await statsService.onDataChanged(supabase);
  return Response.json({ error: null }, { status: 200 });
}
