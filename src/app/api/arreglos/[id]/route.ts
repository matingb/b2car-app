import { ArregloDto } from "@/model/dtos";
import { Arreglo } from "@/model/types";
import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";

export type GetArregloByIdResponse = {
  data: Arreglo | null;
  error?: string | null;
};

export type UpdateArregloRequest = {
  tipo?: string;
  descripcion?: string;
  kilometraje_leido?: number;
  fecha?: string;
  observaciones?: string;
  precio_final?: number;
  esta_pago?: boolean;
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

  const { data: data, error: aError } = await supabase
    .from("arreglos")
    .select("*, vehiculo:vehiculos(*)")
    .eq("id", id)
    .single();

  if (aError) {
    const status = aError.code === "PGRST116" ? 404 : 500;
    return Response.json({ data: null, error: aError.message }, { status });
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

  const { data, error } = await supabase
    .from('arreglos')
    .update(payload)
    .eq('id', id)
    .select('*, vehiculo:vehiculos(*)')
    .single();

  if (error) {
    return Response.json({ data: null, error: error.message }, { status: 500 });
  }

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


  const { error } = await supabase
    .from('arreglos')
    .delete()
    .eq('id', id);

  return Response.json({ error }, { status: error ? 500 : 200 });
}
