import { Vehiculo, Arreglo } from "@/model/types";
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

  // 1) Vehículo (desde la vista para obtener nombre_cliente)
  const { data: vData, error: vError } = await supabase
    .from("vista_vehiculos_con_clientes")
    .select("*")
    .eq("id", id)
    .single();

  if (vError) {
    const status = vError.code === "PGRST116" ? 404 : 500;
    return Response.json({ data: null, error: vError.message }, { status });
  }

  const vehiculo: Vehiculo = {
    id: vData.id,
    nombre_cliente: vData.nombre_cliente,
    patente: vData.patente,
    marca: vData.marca,
    modelo: vData.modelo,
    fecha_patente: vData.fecha_patente,
  };

  // 2) Arreglos del vehículo
  const { data: aData, error: aError } = await supabase
    .from("arreglos")
    .select("*, vehiculo:vehiculos(*)")
    .eq("vehiculo_id", id)
    .order("fecha", { ascending: false });

  if (aError) {
    return Response.json({ data: vehiculo, arreglos: [], error: aError.message }, { status: 500 });
  }

  const arreglos: Arreglo[] = (aData || []).map((a) => ({
    id: a.id,
    vehiculo: a.vehiculo,
    tipo: a.tipo,
    descripcion: a.descripcion,
    kilometraje_leido: a.kilometraje_leido,
    fecha: a.fecha,
    observaciones: a.observaciones,
    precio_final: a.precio_final,
    precio_sin_iva: a.precio_sin_iva,
    esta_pago: a.esta_pago,
    extra_data: a.extra_data,
  }));

  return Response.json({ data: vehiculo, arreglos, error: null });
}

// PUT /api/vehiculos/[id]
// Actualiza los datos de un vehículo
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  let body: { patente?: string; marca?: string; modelo?: string; fecha_patente?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updateData: Record<string, string | number | undefined> = {};
  if (body.patente !== undefined) updateData.patente = body.patente;
  if (body.marca !== undefined) updateData.marca = body.marca;
  if (body.modelo !== undefined) updateData.modelo = body.modelo;
  if (body.fecha_patente !== undefined) updateData.fecha_patente = body.fecha_patente;

  if (Object.keys(updateData).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  // Verificar que el vehículo existe
  const { data: checkData, error: checkError } = await supabase
    .from("vehiculos")
    .select("*")
    .eq("id", id)
    .single();

  if (checkError || !checkData) {
    return Response.json({ error: "Vehículo no encontrado" }, { status: 404 });
  }

  // Actualizar el vehículo
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