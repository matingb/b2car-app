import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";
import { detalleArregloService } from "@/app/api/arreglos/detalleArregloService";
import { syncArregloDescripcion } from "@/app/api/arreglos/arregloDescripcionService";
import { ServiceError } from "@/app/api/serviceError";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { isValidUuid } from "@/lib/uuid";

export type CreateDetalleArregloRequest = {
  descripcion: string;
  cantidad: number;
  precio_hora_facturada: number;
  horas_facturadas?: number;
  horas_trabajadas?: number;
  categoria_arreglo_id?: string | null;
  empleado_id?: string | null;
};

export type DetalleArregloResponseRow = {
  id: string;
  arreglo_id: string;
  descripcion: string;
  cantidad: number;
  precio_hora_facturada: number;
  horas_facturadas: number;
  horas_trabajadas: number;
  categoria_arreglo_id: string | null;
  empleado_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateDetalleArregloResponse = {
  data: DetalleArregloResponseRow | null;
  error?: string | null;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id: arregloId } = await params;

  const body: CreateDetalleArregloRequest | null = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ data: null, error: "JSON inválido" } satisfies CreateDetalleArregloResponse, { status: 400 });
  }

  const descripcion = String(body.descripcion ?? "").trim();
  const cantidad = Number(body.cantidad);
  const precioHoraFacturada = Number(body.precio_hora_facturada);
  const horasFacturadas = body.horas_facturadas != null ? Number(body.horas_facturadas) : 1;
  const horasTrabajadas = body.horas_trabajadas != null ? Number(body.horas_trabajadas) : 1;
  const categoriaArregloIdRaw = body.categoria_arreglo_id;
  const empleadoIdRaw = body.empleado_id;

  if (!arregloId) {
    return Response.json({ data: null, error: "Falta arreglo_id" } satisfies CreateDetalleArregloResponse, { status: 400 });
  }
  if (!descripcion) {
    return Response.json({ data: null, error: "Falta descripción" } satisfies CreateDetalleArregloResponse, { status: 400 });
  }
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return Response.json({ data: null, error: "Cantidad inválida" } satisfies CreateDetalleArregloResponse, { status: 400 });
  }
  if (!Number.isFinite(precioHoraFacturada) || precioHoraFacturada < 0) {
    return Response.json({ data: null, error: "Precio hora facturada inválido" } satisfies CreateDetalleArregloResponse, { status: 400 });
  }
  if (!Number.isFinite(horasFacturadas) || horasFacturadas < 0) {
    return Response.json({ data: null, error: "Horas facturadas inválidas" } satisfies CreateDetalleArregloResponse, { status: 400 });
  }
  if (!Number.isFinite(horasTrabajadas) || horasTrabajadas < 0) {
    return Response.json({ data: null, error: "Horas trabajadas inválidas" } satisfies CreateDetalleArregloResponse, { status: 400 });
  }
  if (categoriaArregloIdRaw != null && !isValidUuid(categoriaArregloIdRaw)) {
    return Response.json({ data: null, error: "categoria_arreglo_id inválido" } satisfies CreateDetalleArregloResponse, { status: 400 });
  }
  if (empleadoIdRaw != null && !isValidUuid(empleadoIdRaw)) {
    return Response.json({ data: null, error: "empleado_id inválido" } satisfies CreateDetalleArregloResponse, { status: 400 });
  }

  const { data, error } = await detalleArregloService.create(supabase, {
    arreglo_id: arregloId,
    descripcion,
    cantidad,
    precio_hora_facturada: precioHoraFacturada,
    horas_facturadas: horasFacturadas,
    horas_trabajadas: horasTrabajadas,
    categoria_arreglo_id: categoriaArregloIdRaw ?? null,
    empleado_id: empleadoIdRaw ?? null,
  });

  if (error || !data) {
    return Response.json(
      { data: null, error: "Error creando detalle del arreglo" } satisfies CreateDetalleArregloResponse,
      { status: 500 }
    );
  }

  const { error: syncError } = await syncArregloDescripcion(supabase, arregloId);
  if (syncError) {
    const status = syncError === ServiceError.NotFound ? 404 : 500;
    const message = "Error actualizando la descripción del arreglo";
    return Response.json({ data: null, error: message } satisfies CreateDetalleArregloResponse, { status });
  }

  await statsService.onDataChanged(supabase);

  return Response.json({ data, error: null } satisfies CreateDetalleArregloResponse, { status: 201 });
}
