import { ArregloDto, VehiculoDto } from "@/model/dtos";
import { Arreglo, Vehiculo } from "@/model/types";
import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";

export type GetArregloByIdResponse = {
  data: { arreglo: Arreglo | null; vehiculo: Vehiculo | null; } | null;
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

  const { data: aData, error: aError } = await supabase
    .from("arreglos")
    .select("*, vehiculo:vehiculos(*)")
    .eq("id", id)
    .single();

  if (aError) {
    const status = aError.code === "PGRST116" ? 404 : 500;
    return Response.json({ data: null, error: aError.message }, { status });
  }

  const arreglo = {
    id: aData.id,
    tipo: aData.tipo,
    descripcion: aData.descripcion,
    kilometraje_leido: aData.kilometraje_leido,
    fecha: aData.fecha,
    observaciones: aData.observaciones,
    precio_final: aData.precio_final,
    precio_sin_iva: aData.precio_sin_iva,
    esta_pago: aData.esta_pago,
    extra_data: aData.extra_data,
  } as const;

  const vehiculo: VehiculoDto | null = aData.vehiculo ?? null;


  return Response.json({ data: { arreglo, vehiculo }, error: null });
}

// POST /api/arreglos/[id] -> actualizar arreglo (edición parcial)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const payload: Partial<ArregloDto> | null = await req.json().catch(() => null);
  if (!payload) return Response.json({ error: "JSON inválido" }, { status: 400 });

  // Si cambia precio_final, recalcular precio_sin_iva
  if ('precio_final' in payload) {
    const getIvaRate = () => {
      const rateEnv = process.env.IVA_RATE; // e.g., 0.21
      const percentEnv = process.env.IVA_PERCENT; // e.g., 21
      let DEF_RATE = 0.21;
      if (rateEnv && !Number.isNaN(Number(rateEnv)) && Number(rateEnv) >= 0 && Number(rateEnv) < 1) {
        DEF_RATE = Number(rateEnv);
      } else if (percentEnv && !Number.isNaN(Number(percentEnv)) && Number(percentEnv) >= 0) {
        DEF_RATE = Number(percentEnv) / 100;
      }
      return DEF_RATE;
    };
    const ivaRate = getIvaRate();
    const computedSinIva = Number((Number(payload.precio_final) / (1 + ivaRate)).toFixed(2));
    payload.precio_sin_iva = computedSinIva;
  }

  const { error } = await supabase
    .from('arreglos')
    .update(payload)
    .eq('id', id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ error: null }, { status: 200 });
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
    .select()
    .single();

  return Response.json({ data, error }, { status: error ? 500 : 200 });
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
