import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";
import { detalleArregloService } from "@/app/api/arreglos/detalleArregloService";
import { syncArregloDescripcion } from "@/app/api/arreglos/arregloDescripcionService";
import { ServiceError } from "@/app/api/serviceError";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { isValidUuid } from "@/lib/uuid";
import { hasUserPermission } from "@/lib/permissions.server";
import { Permission } from "@/lib/permissions";
import { hasAtMostDecimalPlaces } from "@/lib/numbers";

export type CreateDetalleArregloRequest = {
  descripcion: string;
  cantidad: number;
  precio_hora_facturada?: number | null;
  horas_facturadas?: number | null;
  horas_trabajadas?: number | null;
  valor_hora_empleado?: number | null;
  categoria_arreglo_id?: string | null;
  empleado_id?: string | null;
};

export type DetalleArregloResponseRow = {
  id: string;
  arreglo_id: string;
  descripcion: string;
  cantidad: number;
  precio_hora_facturada: number;
  horas_facturadas: number | null;
  horas_trabajadas: number | null;
  valor_hora_empleado?: number | null;
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
  const precioHoraFacturada = body.precio_hora_facturada == null
    ? undefined
    : Number(body.precio_hora_facturada);
  const horasFacturadas = body.horas_facturadas != null ? Number(body.horas_facturadas) : 1;
  const horasTrabajadas = body.horas_trabajadas != null ? Number(body.horas_trabajadas) : 1;
  const valorHoraEmpleado = body.valor_hora_empleado == null ? null : Number(body.valor_hora_empleado);
  const categoriaArregloIdRaw = body.categoria_arreglo_id;
  const empleadoIdRaw = body.empleado_id;

  if (!arregloId) {
    return Response.json({ data: null, error: "Falta arreglo_id" } satisfies CreateDetalleArregloResponse, { status: 400 });
  }
  if (!descripcion) {
    return Response.json({ data: null, error: "Falta descripción" } satisfies CreateDetalleArregloResponse, { status: 400 });
  }
  if (!Number.isSafeInteger(cantidad) || cantidad <= 0 || cantidad > 2_147_483_647) {
    return Response.json({ data: null, error: "Cantidad inválida" } satisfies CreateDetalleArregloResponse, { status: 400 });
  }
  if (precioHoraFacturada !== undefined && (!Number.isFinite(precioHoraFacturada) || precioHoraFacturada < 0 || precioHoraFacturada > 9_999_999_999.99 || !hasAtMostDecimalPlaces(precioHoraFacturada))) {
    return Response.json({ data: null, error: "Precio hora facturada inválido" } satisfies CreateDetalleArregloResponse, { status: 400 });
  }
  if (!Number.isFinite(horasFacturadas) || horasFacturadas < 0 || horasFacturadas > 9999.99 || !hasAtMostDecimalPlaces(horasFacturadas)) {
    return Response.json({ data: null, error: "Horas facturadas inválidas" } satisfies CreateDetalleArregloResponse, { status: 400 });
  }
  if (!Number.isFinite(horasTrabajadas) || horasTrabajadas < 0 || horasTrabajadas > 9999.99 || !hasAtMostDecimalPlaces(horasTrabajadas)) {
    return Response.json({ data: null, error: "Horas trabajadas inválidas" } satisfies CreateDetalleArregloResponse, { status: 400 });
  }
  if (precioHoraFacturada !== undefined && !(await hasUserPermission(supabase, Permission.ArreglosPreciosEdit))) {
    return Response.json({ data: null, error: "No tenés permiso para modificar precios" } satisfies CreateDetalleArregloResponse, { status: 403 });
  }
  if (valorHoraEmpleado !== null && (!Number.isFinite(valorHoraEmpleado) || valorHoraEmpleado < 0 || valorHoraEmpleado > 9_999_999_999.99 || !hasAtMostDecimalPlaces(valorHoraEmpleado))) {
    return Response.json({ data: null, error: "Valor hora del empleado invÃ¡lido" } satisfies CreateDetalleArregloResponse, { status: 400 });
  }
  if (body.valor_hora_empleado != null && !(await hasUserPermission(supabase, Permission.EmpleadosEdit))) {
    return Response.json({ data: null, error: "No tenÃ©s permiso para modificar costos de mano de obra" } satisfies CreateDetalleArregloResponse, { status: 403 });
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
    ...(precioHoraFacturada === undefined ? {} : { precio_hora_facturada: precioHoraFacturada }),
    horas_facturadas: horasFacturadas,
    horas_trabajadas: horasTrabajadas,
    valor_hora_empleado: valorHoraEmpleado,
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
