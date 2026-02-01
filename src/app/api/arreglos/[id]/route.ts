import { Arreglo } from "@/model/types";
import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { arregloService } from "@/app/api/arreglos/arregloService";
import { detalleArregloService } from "@/app/api/arreglos/detalleArregloService";
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
  producto_id: string;
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

  const { data: arreglo, error } = await arregloService.getByIdWithVehiculo(supabase, id);

  if (error) {
    const status = error === ServiceError.NotFound ? 404 : 500;
    const message = status === 404 ? "Arreglo no encontrado" : "Error cargando arreglo";
    return Response.json({ data: null, error: message }, { status });
  }

  const { data: detallesRows, error: detallesError } = await detalleArregloService.listByArregloId(supabase, id);

  if (detallesError) {
    return Response.json({ data: null, error: "Error cargando detalles del arreglo" }, { status: 500 });
  }

  const { data: asigRows, error: asigError } = await supabase
    .from("operaciones_asignacion_arreglo")
    .select(`
      operacion:operaciones(
        id,
        tipo,
        taller_id,
        created_at,
        operaciones_lineas(
          id,
          operacion_id,
          producto_id,
          cantidad,
          monto_unitario,
          delta_cantidad,
          created_at,
          producto:productos(
            id,
            codigo,
            nombre,
            precio_unitario,
            costo_unitario,
            proveedor,
            categorias
          )
        )
      )
    `)
    .eq("arreglo_id", id);

  if (asigError) {
    return Response.json({ data: null, error: "Error cargando asignaciones del arreglo" }, { status: 500 });
  }

  const detalles: DetalleArreglo[] = Array.isArray(detallesRows)
    ? detallesRows.map((r) => ({
        id: String((r as { id?: unknown }).id ?? ""),
        arreglo_id: String((r as { arreglo_id?: unknown }).arreglo_id ?? ""),
        descripcion: String((r as { descripcion?: unknown }).descripcion ?? ""),
        cantidad: Number((r as { cantidad?: unknown }).cantidad ?? 0) || 0,
        valor: Number((r as { valor?: unknown }).valor ?? 0) || 0,
        created_at: String((r as { created_at?: unknown }).created_at ?? ""),
        updated_at: String((r as { updated_at?: unknown }).updated_at ?? ""),
      }))
    : [];

  const asignaciones: AsignacionArregloOperacion[] = Array.isArray(asigRows)
    ? (asigRows
        .map((row) => (row as { operacion?: unknown } | null)?.operacion)
        .filter(Boolean)
        .map((opUnknown) => {
          const op = opUnknown as Record<string, unknown>;
          const lineasRaw = Array.isArray(op.operaciones_lineas) ? (op.operaciones_lineas as unknown[]) : [];
          const lineas: AsignacionArregloLinea[] = lineasRaw.map((l) => {
            const linea = l as Record<string, unknown>;
            const prod = (linea.producto ?? null) as Record<string, unknown> | null;
            return {
              id: String(linea.id ?? ""),
              operacion_id: String(linea.operacion_id ?? ""),
              producto_id: String(linea.producto_id ?? ""),
              cantidad: Number(linea.cantidad ?? 0) || 0,
              monto_unitario: Number(linea.monto_unitario ?? 0) || 0,
              delta_cantidad: Number(linea.delta_cantidad ?? 0) || 0,
              created_at: String(linea.created_at ?? ""),
              producto: prod
                ? {
                    id: String(prod.id ?? ""),
                    codigo: String(prod.codigo ?? ""),
                    nombre: String(prod.nombre ?? ""),
                    precio_unitario: Number(prod.precio_unitario ?? 0) || 0,
                    costo_unitario: Number(prod.costo_unitario ?? 0) || 0,
                    proveedor: (prod.proveedor as string | null | undefined) ?? null,
                    categorias: Array.isArray(prod.categorias) ? (prod.categorias as string[]) : [],
                  }
                : null,
            };
          });

          return {
            id: String(op.id ?? ""),
            tipo: String(op.tipo ?? ""),
            taller_id: String(op.taller_id ?? ""),
            created_at: String(op.created_at ?? ""),
            lineas,
          };
        })) as AsignacionArregloOperacion[]
    : [];

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
