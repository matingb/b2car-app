import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { VehiculoServiceError, vehiculoService } from "../vehiculoService";

// GET /api/vehiculos/[id]
// Devuelve los datos de un vehículo junto con sus arreglos
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data, arreglos, error } = await vehiculoService.getById(supabase, id);
  if (error) {
    const status = error === VehiculoServiceError.NotFound ? 404 : 500;
    const message = status === 404 ? "Vehículo no encontrado" : "Error cargando vehículo";
    return Response.json({ data: null, error: message }, { status });
  }

  return Response.json({ data, arreglos, error: null });
}

// PUT /api/vehiculos/[id]
// Actualiza los datos de un vehículo
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  let body: { patente?: string; marca?: string; modelo?: string; fecha_patente?: string; nro_interno?: string | null };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updateData: Record<string, string | number | null | undefined> = {};
  if (body.patente !== undefined) updateData.patente = body.patente;
  if (body.marca !== undefined) updateData.marca = body.marca;
  if (body.modelo !== undefined) updateData.modelo = body.modelo;
  if (body.fecha_patente !== undefined) updateData.fecha_patente = body.fecha_patente;
  if (body.nro_interno !== undefined) updateData.nro_interno = body.nro_interno ? body.nro_interno : null;

  if (Object.keys(updateData).length === 0) {
    return Response.json({ error: "No hay campos para actualizar" }, { status: 400 });
  }

  const { data, error, notFound } = await vehiculoService.updateById(supabase, id, updateData);
  if (error) {
    return Response.json({ error: error.message }, { status: notFound ? 404 : 500 });
  }

  await statsService.onDataChanged(supabase);
  return Response.json({ data, error: null });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();

  const { id } = await params;
  if (!id) return Response.json({ error: 'Falta id' }, { status: 400 });

  const { error } = await vehiculoService.deleteById(supabase, id);
  if (error) return Response.json({ error: error.message || 'No se pudo eliminar el vehículo' }, { status: 500 });

  await statsService.onDataChanged(supabase);
  return Response.json({ error: null }, { status: 200 });
}