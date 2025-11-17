import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";

// POST /api/arreglos/[id] -> actualizar arreglo (edición parcial)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "JSON inválido" }, { status: 400 });

  // Solo aceptar campos conocidos (precio_sin_iva se calcula en base a precio_final)
  const allowed = [
    'tipo',
    'descripcion',
    'kilometraje_leido',
    'fecha',
    'observaciones',
    'precio_final',
    'esta_pago',
    'extra_data',
  ] as const;

  const payload: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) payload[k] = (body as Record<string, unknown>)[k];
  }

  if (Object.keys(payload).length === 0) {
    return Response.json({ error: 'Nada para actualizar' }, { status: 400 });
  }

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
