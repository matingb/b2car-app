import { Arreglo } from "@/model/types";
import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { ArregloServiceError, arregloService } from "@/app/api/arreglos/arregloService";
import type { UpdateArregloRequest } from "../arregloRequests";

export type GetArregloByIdResponse = {
  data: Arreglo | null;
  error?: string | null;
};

export type UpdateArregloResponse = {
  data: Arreglo | null;
  error?: string | null;
};

// GET /api/arreglos/[id] -> obtener un arreglo con su vehículo y cliente
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: data, error } = await arregloService.getByIdWithVehiculo(supabase, id);

  if (error) {
    const status = error === ArregloServiceError.NotFound ? 404 : 500;
    const message = status === 404 ? "Arreglo no encontrado" : "Error cargando arreglo";
    return Response.json({ data: null, error: message }, { status });
  }

  return Response.json({ data: data, error: null });
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
    const status = error === ArregloServiceError.NotFound ? 404 : 500;
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
    const status = error === ArregloServiceError.NotFound ? 404 : 500;
    const message = status === 404 ? "Arreglo no encontrado" : "Error eliminando arreglo";
    return Response.json({ error: message }, { status });
  }

  await statsService.onDataChanged(supabase);
  return Response.json({ error: null }, { status: 200 });
}
