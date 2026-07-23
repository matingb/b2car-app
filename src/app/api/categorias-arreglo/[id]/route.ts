import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { createClient } from "@/supabase/server";
import { categoriasArregloService, type CategoriaArregloRow } from "../categoriasArregloService";
import { ServiceError } from "@/app/api/serviceError";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import type { CategoriaArregloDTO } from "../route";

export type UpdateCategoriaArregloRequest = Partial<{
  nombre: string;
}>;

export type UpdateCategoriaArregloResponse = {
  data: CategoriaArregloDTO | null;
  error?: string | null;
};

export type DeleteCategoriaArregloResponse = {
  error?: string | null;
};

function mapCategoriaArreglo(row: CategoriaArregloRow): CategoriaArregloDTO {
  return {
    id: row.id,
    nombre: row.nombre,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies UpdateCategoriaArregloResponse, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return Response.json({ data: null, error: "Falta id" } satisfies UpdateCategoriaArregloResponse, { status: 400 });
  }

  const body: UpdateCategoriaArregloRequest | null = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ data: null, error: "JSON inválido" } satisfies UpdateCategoriaArregloResponse, { status: 400 });
  }

  const patch: Partial<Pick<CategoriaArregloRow, "nombre">> = {};
  if (body.nombre !== undefined) {
    const nombre = String(body.nombre ?? "").trim();
    if (!nombre) {
      return Response.json({ data: null, error: "Nombre inválido" } satisfies UpdateCategoriaArregloResponse, { status: 400 });
    }
    patch.nombre = nombre;
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ data: null, error: "No hay cambios" } satisfies UpdateCategoriaArregloResponse, { status: 400 });
  }

  try {
    const { data, error } = await categoriasArregloService.updateById(supabase, id, patch);

    if (error === ServiceError.NotFound || !data) {
      return Response.json({ data: null, error: "Categoría de arreglo no encontrada" } satisfies UpdateCategoriaArregloResponse, { status: 404 });
    }
    if (error) {
      const raw = String((error as { message?: unknown } | null)?.message ?? "");
      if (raw.includes("uq_categorias_arreglo_tenant_nombre_lower")) {
        return Response.json(
          { data: null, error: "Ya existe una categoría de arreglo con ese nombre" } satisfies UpdateCategoriaArregloResponse,
          { status: 409 }
        );
      }
      return Response.json({ data: null, error: "Error actualizando categoría de arreglo" } satisfies UpdateCategoriaArregloResponse, { status: 500 });
    }

    await statsService.onDataChanged(supabase);
    return Response.json({ data: mapCategoriaArreglo(data), error: null } satisfies UpdateCategoriaArregloResponse, { status: 200 });
  } catch (error: unknown) {
    logger.error("PUT /api/categorias-arreglo/[id] error:", error);
    return Response.json({ data: null, error: "Error actualizando categoría de arreglo" } satisfies UpdateCategoriaArregloResponse, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ error: "Unauthorized" } satisfies DeleteCategoriaArregloResponse, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return Response.json({ error: "Falta id" } satisfies DeleteCategoriaArregloResponse, { status: 400 });
  }

  try {
    const { error } = await categoriasArregloService.deleteById(supabase, id);
    if (error === ServiceError.NotFound) {
      return Response.json({ error: "Categoría de arreglo no encontrada" } satisfies DeleteCategoriaArregloResponse, { status: 404 });
    }
    if (error) {
      return Response.json({ error: "Error eliminando categoría de arreglo" } satisfies DeleteCategoriaArregloResponse, { status: 500 });
    }

    await statsService.onDataChanged(supabase);
    return Response.json({ error: null } satisfies DeleteCategoriaArregloResponse, { status: 200 });
  } catch (error: unknown) {
    logger.error("DELETE /api/categorias-arreglo/[id] error:", error);
    return Response.json({ error: "Error eliminando categoría de arreglo" } satisfies DeleteCategoriaArregloResponse, { status: 500 });
  }
}
