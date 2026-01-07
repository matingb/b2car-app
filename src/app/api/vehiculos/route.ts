import { createClient } from "@/supabase/server"
import { logger } from "@/lib/logger"
import { vehiculoService } from "./vehiculoService"
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";

export type CreateVehiculoRequest = {
  cliente_id: string;
  patente: string;
  marca?: string;
  modelo?: string;
  fecha_patente?: string;
  nro_interno?: string;
};

export type CreateVehiculoResponse = {
  data?: { id: string } | null;
  error?: string | null;
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
    let message  = "Error al crear vehículo";
    if (status === 409) {
      logger.error(`❌ Conflicto al crear vehículo: patente ya existe (${patente})`);
      message = `Ya existe un vehículo con la patente '${patente}'`;
    } else {
      logger.error(`❌ Error al crear vehículo: ${insertError.message}`);
    }

    return Response.json({ error: message || 'No se pudo crear el vehículo' }, { status });
  }

  const response : CreateVehiculoResponse = {
    data: inserted,
    error: null,
  };

  await statsService.onDataChanged(supabase);
  return Response.json(response, { status: 201 });
}
