import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { createClient } from "@/supabase/server";
import { tiposArregloService, type TipoArregloRow } from "../tiposArregloService";
import { ServiceError } from "@/app/api/serviceError";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import type { TipoArregloDTO } from "../route";

export type UpdateTipoArregloRequest = Partial<{
  nombre: string;
  activo: boolean;
  color: string | null;
}>;

export type UpdateTipoArregloResponse = {
  data: TipoArregloDTO | null;
  error?: string | null;
};

export type DeleteTipoArregloResponse = {
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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies UpdateTipoArregloResponse, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return Response.json({ data: null, error: "Falta id" } satisfies UpdateTipoArregloResponse, { status: 400 });
  }

  const body: UpdateTipoArregloRequest | null = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ data: null, error: "JSON inválido" } satisfies UpdateTipoArregloResponse, { status: 400 });
  }

  const patch: Partial<Pick<TipoArregloRow, "nombre" | "activo" | "color">> = {};
  if (body.nombre !== undefined) {
    const nombre = String(body.nombre ?? "").trim();
    if (!nombre) {
      return Response.json({ data: null, error: "Nombre inválido" } satisfies UpdateTipoArregloResponse, { status: 400 });
    }
    patch.nombre = nombre;
  }
  if (body.activo !== undefined) patch.activo = Boolean(body.activo);
  if (body.color !== undefined) patch.color = body.color?.trim() || null;

  if (Object.keys(patch).length === 0) {
    return Response.json({ data: null, error: "No hay cambios" } satisfies UpdateTipoArregloResponse, { status: 400 });
  }

  try {
    const { data, error } = await tiposArregloService.updateById(supabase, id, patch);

    if (error === ServiceError.NotFound || !data) {
      return Response.json({ data: null, error: "Tipo de arreglo no encontrado" } satisfies UpdateTipoArregloResponse, { status: 404 });
    }
    if (error) {
      const raw = String((error as { message?: unknown } | null)?.message ?? "");
      if (raw.includes("uq_tipos_arreglo_tenant_nombre_lower")) {
        return Response.json(
          { data: null, error: "Ya existe un tipo de arreglo con ese nombre" } satisfies UpdateTipoArregloResponse,
          { status: 409 }
        );
      }
      return Response.json({ data: null, error: "Error actualizando tipo de arreglo" } satisfies UpdateTipoArregloResponse, { status: 500 });
    }

    await statsService.onDataChanged(supabase);
    return Response.json({ data: mapTipoArreglo(data), error: null } satisfies UpdateTipoArregloResponse, { status: 200 });
  } catch (error: unknown) {
    logger.error("PUT /api/tipos-arreglo/[id] error:", error);
    return Response.json({ data: null, error: "Error actualizando tipo de arreglo" } satisfies UpdateTipoArregloResponse, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ error: "Unauthorized" } satisfies DeleteTipoArregloResponse, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return Response.json({ error: "Falta id" } satisfies DeleteTipoArregloResponse, { status: 400 });
  }

  try {
    const { error } = await tiposArregloService.deleteById(supabase, id);
    if (error === ServiceError.NotFound) {
      return Response.json({ error: "Tipo de arreglo no encontrado" } satisfies DeleteTipoArregloResponse, { status: 404 });
    }
    if (error) {
      return Response.json({ error: "Error eliminando tipo de arreglo" } satisfies DeleteTipoArregloResponse, { status: 500 });
    }

    await statsService.onDataChanged(supabase);
    return Response.json({ error: null } satisfies DeleteTipoArregloResponse, { status: 200 });
  } catch (error: unknown) {
    logger.error("DELETE /api/tipos-arreglo/[id] error:", error);
    return Response.json({ error: "Error eliminando tipo de arreglo" } satisfies DeleteTipoArregloResponse, { status: 500 });
  }
}
