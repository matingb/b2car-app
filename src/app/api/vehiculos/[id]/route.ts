import { Vehiculo, Arreglo } from "@/model/types";
import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";

// GET /api/vehiculos/[id]
// Devuelve los datos de un vehículo junto con sus arreglos
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
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
    const status = (vError as any)?.code === "PGRST116" ? 404 : 500;
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
