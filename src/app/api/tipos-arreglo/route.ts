import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { createClient } from "@/supabase/server";
import { tiposArregloService, type TipoArregloRow } from "./tiposArregloService";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";

export type TipoArregloDTO = {
  id: string;
  nombre: string;
  activo: boolean;
  color: string | null;
  created_at: string;
  updated_at: string;
};

export type GetTiposArregloResponse = {
  data: TipoArregloDTO[];
  error?: string | null;
};

export type CreateTipoArregloRequest = {
  nombre: string;
  color?: string | null;
};

export type CreateTipoArregloResponse = {
  data: TipoArregloDTO | null;
  error?: string | null;
};

function mapTipoArreglo(row: TipoArregloRow): TipoArregloDTO {
  return {
    id: row.id,
    nombre: row.nombre,
    activo: row.activo,
    color: row.color ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ data: [], error: "Unauthorized" } satisfies GetTiposArregloResponse, { status: 401 });
  }

  const soloActivos = req.nextUrl.searchParams.get("solo_activos") === "true";

  const { data, error } = await tiposArregloService.list(supabase, { soloActivos });
  if (error) {
    return Response.json(
      { data: [], error: "Error listando tipos de arreglo" } satisfies GetTiposArregloResponse,
      { status: 500 }
    );
  }

  return Response.json(
    { data: data.map(mapTipoArreglo), error: null } satisfies GetTiposArregloResponse,
    { status: 200 }
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies CreateTipoArregloResponse, { status: 401 });
  }

  const body: CreateTipoArregloRequest | null = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ data: null, error: "JSON inválido" } satisfies CreateTipoArregloResponse, { status: 400 });
  }

  const nombre = String(body.nombre ?? "").trim();
  if (!nombre) {
    return Response.json({ data: null, error: "Falta nombre" } satisfies CreateTipoArregloResponse, { status: 400 });
  }

  try {
    const { data: created, error } = await tiposArregloService.create(supabase, {
      nombre,
      color: body.color?.trim() || null,
    });

    if (error) {
      const raw = String((error as { message?: unknown } | null)?.message ?? "");
      if (raw.includes("uq_tipos_arreglo_tenant_nombre_lower")) {
        return Response.json(
          { data: null, error: "Ya existe un tipo de arreglo con ese nombre" } satisfies CreateTipoArregloResponse,
          { status: 409 }
        );
      }
      return Response.json({ data: null, error: "Error creando tipo de arreglo" } satisfies CreateTipoArregloResponse, { status: 500 });
    }
    if (!created) {
      return Response.json({ data: null, error: "Error creando tipo de arreglo" } satisfies CreateTipoArregloResponse, { status: 500 });
    }

    await statsService.onDataChanged(supabase);
    return Response.json({ data: mapTipoArreglo(created), error: null } satisfies CreateTipoArregloResponse, { status: 201 });
  } catch (error: unknown) {
    logger.error("POST /api/tipos-arreglo error:", error);
    return Response.json({ data: null, error: "Error creando tipo de arreglo" } satisfies CreateTipoArregloResponse, { status: 500 });
  }
}
