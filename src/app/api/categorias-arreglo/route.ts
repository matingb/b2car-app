import { createApiHandler } from "../apiHandler";
import { parseInput, readJsonBody, type Validated } from "../apiInput";
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

function validateCreateCategoria(raw: unknown): Validated<CreateCategoriaArregloRequest> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: "JSON inválido" };
  const nombre = String((raw as Record<string, unknown>).nombre ?? "").trim();
  return nombre ? { value: { nombre } } : { error: "Falta nombre" };
}

export const GET = createApiHandler(
  {
    route: "GET /api/categorias-arreglo",
    fallback: "Error listando categorías de arreglo"
  },
  async (ctx) => {
    const { data, error, cause } = await categoriasArregloService.list(ctx.supabase);
    if (error) return ctx.fail(cause ?? error);
    return Response.json({ data: data.map(mapCategoriaArreglo), error: null } satisfies GetCategoriasArregloResponse);
  },
);

export const POST = createApiHandler(
  {
    route: "POST /api/categorias-arreglo",
    fallback: "Error creando categoría de arreglo",
  },
  async (ctx) => {
    const body = parseInput(validateCreateCategoria, await readJsonBody(ctx.req));
    const { data: created, error } = await categoriasArregloService.create(ctx.supabase, body);
    if (error) return ctx.fail(error, {
      constraintMessages: { uq_categorias_arreglo_tenant_nombre_lower: "Ya existe una categoría de arreglo con ese nombre" },
    });
    if (!created) return ctx.fail(new Error("La creación no devolvió una categoría"));
    await statsService.onDataChanged(ctx.supabase, ctx.actor.tenantId);
    return Response.json({ data: mapCategoriaArreglo(created), error: null } satisfies CreateCategoriaArregloResponse, { status: 201 });
  },
);
