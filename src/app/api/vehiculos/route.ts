import { NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import { logger } from "@/lib/logger";
import { vehiculoService, type VehiculoListFilters } from "./vehiculoService";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { normalizePaginationLimit, normalizePage } from "@/lib/pagination";

export type CreateVehiculoRequest = {
  cliente_id: string;
  patente: string;
  marca?: string;
  modelo?: string;
  fecha_patente?: string;
  numero_chasis?: string;
  nro_interno?: string;
  color?: string;
  numero_motor?: string;
};

export type CreateVehiculoResponse = {
  data?: { id: string } | null;
  error?: string | null;
};

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const searchParams = req.nextUrl.searchParams;

  const filters: VehiculoListFilters = {
    search: searchParams.get("search")?.trim() || undefined,
    cliente_id: searchParams.get("cliente_id")?.trim() || undefined,
    limit: searchParams.get("limit") ? normalizePaginationLimit(searchParams.get("limit")) : undefined,
    page: searchParams.get("page") ? normalizePage(searchParams.get("page")) : undefined,
  };

  const { data, hasMore, error } = await vehiculoService.list(supabase, filters);

  logger.debug("GET /api/vehiculos - data:", data, "error:", error);

  if (error) {
    return Response.json(
      { data: [], page: { hasMore: false }, error: error.message },
      { status: 500 }
    );
  }

  return Response.json({
    data: data ?? [],
    page: { hasMore: Boolean(hasMore) },
    error: null,
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "JSON inválido" }, { status: 400 });

  const { cliente_id, patente, marca, modelo, fecha_patente, numero_chasis, nro_interno, color, numero_motor } = body as CreateVehiculoRequest;

  if (!cliente_id) return Response.json({ error: "Falta cliente_id" }, { status: 400 });
  if (!patente) return Response.json({ error: "Falta patente" }, { status: 400 });
  

  const { data: inserted, error: insertError } = await vehiculoService.create(supabase, {
    cliente_id,
    patente,
    marca: marca ?? "",
    modelo: modelo ?? "",
    fecha_patente: fecha_patente ?? "",
    numero_chasis: (numero_chasis ?? "").toUpperCase(),
    nro_interno: nro_interno ?? "",
    color: color ?? "",
    numero_motor: (numero_motor ?? "").toUpperCase(),
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
