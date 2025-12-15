import { createClient } from "@/supabase/server"
import { logger } from "@/lib/logger"
import { vehiculoService } from "./vehiculoService"

type CreateVehiculoRequest = {
  cliente_id: string;
  patente: string;
  marca?: string;
  modelo?: string;
  fecha_patente?: string;
  nro_interno?: string;
};

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await vehiculoService.list(supabase)

  logger.debug("GET /api/vehiculos - data:", data, "error:", error)

  if (error) {
    return Response.json({ data: [], error: error.message }, { status: 500 })
  }

  return Response.json({ data, error: null })
}

export async function POST(req: Request) {
  const supabase = await createClient();

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "JSON inválido" }, { status: 400 });

  const { cliente_id, patente, marca, modelo, fecha_patente, nro_interno } = body as CreateVehiculoRequest;

  if (!cliente_id) return Response.json({ error: "Falta cliente_id" }, { status: 400 });
  if (!patente) return Response.json({ error: "Falta patente" }, { status: 400 });
  

  const { data: inserted, error: insertError } = await vehiculoService.create(supabase, {
    cliente_id,
    patente,
    marca: marca ?? "",
    modelo: modelo ?? "",
    fecha_patente: fecha_patente ?? "",
    nro_interno: nro_interno ?? "",
  })

  if (insertError) {
    const code = (insertError as { code?: string } | null)?.code || "";
    const status = code === '23505' ? 409 : 500; // 23505: unique_violation
    return Response.json({ error: insertError?.message || 'No se pudo crear el vehículo' }, { status });
  }

  return Response.json({ data: inserted, error: null }, { status: 201 });
}
