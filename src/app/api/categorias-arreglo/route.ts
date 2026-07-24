import { logger } from "@/lib/logger";
import { createClient } from "@/supabase/server";
import { categoriasArregloService, type CategoriaArregloRow } from "./categoriasArregloService";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";

export type CategoriaArregloDTO = {
  id: string;
  nombre: string;
  created_at: string;
  updated_at: string;
};

export type GetCategoriasArregloResponse = {
  data: CategoriaArregloDTO[];
  error?: string | null;
};

export type CreateCategoriaArregloRequest = {
  nombre: string;
};

export type CreateCategoriaArregloResponse = {
  data: CategoriaArregloDTO | null;
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

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ data: [], error: "Unauthorized" } satisfies GetCategoriasArregloResponse, { status: 401 });
  }

  const { data, error } = await categoriasArregloService.list(supabase);
  if (error) {
    return Response.json(
      { data: [], error: "Error listando categorías de arreglo" } satisfies GetCategoriasArregloResponse,
      { status: 500 }
    );
  }

  return Response.json(
    { data: data.map(mapCategoriaArreglo), error: null } satisfies GetCategoriasArregloResponse,
    { status: 200 }
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies CreateCategoriaArregloResponse, { status: 401 });
  }

  const body: CreateCategoriaArregloRequest | null = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ data: null, error: "JSON inválido" } satisfies CreateCategoriaArregloResponse, { status: 400 });
  }

  const nombre = String(body.nombre ?? "").trim();
  if (!nombre) {
    return Response.json({ data: null, error: "Falta nombre" } satisfies CreateCategoriaArregloResponse, { status: 400 });
  }

  try {
    const { data: created, error } = await categoriasArregloService.create(supabase, {
      nombre,
    });

    if (error) {
      const raw = String((error as { message?: unknown } | null)?.message ?? "");
      if (raw.includes("uq_categorias_arreglo_tenant_nombre_lower")) {
        return Response.json(
          { data: null, error: "Ya existe una categoría de arreglo con ese nombre" } satisfies CreateCategoriaArregloResponse,
          { status: 409 }
        );
      }
      return Response.json({ data: null, error: "Error creando categoría de arreglo" } satisfies CreateCategoriaArregloResponse, { status: 500 });
    }
    if (!created) {
      return Response.json({ data: null, error: "Error creando categoría de arreglo" } satisfies CreateCategoriaArregloResponse, { status: 500 });
    }

    await statsService.onDataChanged(supabase);
    return Response.json({ data: mapCategoriaArreglo(created), error: null } satisfies CreateCategoriaArregloResponse, { status: 201 });
  } catch (error: unknown) {
    logger.error("POST /api/categorias-arreglo error:", error);
    return Response.json({ data: null, error: "Error creando categoría de arreglo" } satisfies CreateCategoriaArregloResponse, { status: 500 });
  }
}
