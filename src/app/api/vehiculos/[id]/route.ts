import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";

// GET /api/vehiculos/[id]
// Devuelve los datos de un vehículo junto con sus arreglos
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: vehiculo, error: vError } = await supabase
    .from("vista_vehiculos_con_clientes")
    .select("*")
    .eq("id", id)
    .single();

  if (vError) {
    const status = vError.code === "PGRST116" ? 404 : 500;
    return Response.json({ data: null, error: vError.message }, { status });
  }

  const { data: arreglos, error: aError } = await supabase
    .from("arreglos")
    .select("*, vehiculo:vehiculos(*)")
    .eq("vehiculo_id", id)
    .order("fecha", { ascending: false });

  if (aError) {
    return Response.json({ data: vehiculo, arreglos: [], error: aError.message }, { status: 500 });
  }

  return Response.json({ data: vehiculo, arreglos: arreglos, error: null });
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

  const { data: checkData, error: checkError } = await supabase
    .from("vehiculos")
    .select("*")
    .eq("id", id)
    .single();

  if (checkError || !checkData) {
    return Response.json({ error: "Vehículo no encontrado" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("vehiculos")
    .update(updateData)
    .eq("id", id)
    .select();

  if (error) {
    console.error("Error actualizando vehículo:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    console.error("Update no devolvió datos - vehículo no encontrado o no actualizado");
    return Response.json({ error: "Vehículo no actualizado" }, { status: 404 });
  }

  return Response.json({ data: data[0], error: null });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();

  const { id } = await params;
  if (!id) return Response.json({ error: 'Falta id' }, { status: 400 });

  const { error } = await supabase
    .from('vehiculos')
    .delete()
    .eq('id', id);

  if (error) {
    return Response.json({ error: error?.message || 'No se pudo eliminar el vehículo' }, { status: 500 });
  }

  return Response.json({ error: null }, { status: 200 });
}