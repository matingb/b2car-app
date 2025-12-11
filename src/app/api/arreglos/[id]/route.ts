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

  const { data, error } = await supabase
    .from('arreglos')
    .update(payload)
    .eq('id', id)
    .select('*, vehiculo:vehiculos(*)')
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ data: data, error: null }, { status: 200 });
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
