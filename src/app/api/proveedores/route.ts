import { createApiHandler } from "../apiHandler";
import { parseInput, readJsonBody, type Validated } from "../apiInput";
import { proveedorService, type CreateProveedorInput, type ProveedorRow } from "./proveedorService";
import { Permission } from "@/lib/permissions";
import { ServiceError } from "../serviceError";
import type { Proveedor } from "@/model/types";

export type GetProveedoresResponse = {
  data: Proveedor[];
  error?: string | null;
};

export type CreateProveedorRequest = {
  nombre: string;
  cuit?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
};

export type CreateProveedorResponse = {
  data: Proveedor | null;
  error?: string | null;
};

function mapProveedor(row: ProveedorRow): Proveedor {
  return {
    id: row.id,
    nombre: row.nombre,
    cuit: row.cuit,
    telefono: row.telefono,
    email: row.email,
    direccion: row.direccion,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function validateCreateProveedor(raw: unknown): Validated<CreateProveedorInput> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "JSON inválido" };
  }
  const obj = raw as Record<string, unknown>;
  const nombre = String(obj.nombre ?? "").trim();
  if (!nombre) {
    return { error: "El nombre es obligatorio" };
  }

  return {
    value: {
      nombre,
      cuit: obj.cuit !== undefined && obj.cuit !== null ? String(obj.cuit).trim() : null,
      telefono: obj.telefono !== undefined && obj.telefono !== null ? String(obj.telefono).trim() : null,
      email: obj.email !== undefined && obj.email !== null ? String(obj.email).trim() : null,
      direccion: obj.direccion !== undefined && obj.direccion !== null ? String(obj.direccion).trim() : null,
    },
  };
}

export const GET = createApiHandler(
  {
    route: "GET /api/proveedores",
    permission: Permission.ProveedoresView,
    fallback: "Error al listar proveedores",
  },
  async (ctx) => {
    const search = ctx.req.nextUrl.searchParams.get("search") ?? undefined;
    const limitParam = ctx.req.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;

    const { data, error, cause } = await proveedorService.list(ctx.supabase, {
      search,
      limit,
    });

    if (error) return ctx.fail(cause ?? error);

    return Response.json({
      data: data.map(mapProveedor),
      error: null,
    } satisfies GetProveedoresResponse);
  }
);

export const POST = createApiHandler(
  {
    route: "POST /api/proveedores",
    permission: Permission.ProveedoresEdit,
    fallback: "Error al crear proveedor",
    mapError: (err) => {
      if (err === ServiceError.Conflict) {
        return {
          status: 409,
          code: "CONFLICT",
          message: "Ya existe un proveedor con ese CUIT",
        };
      }
      return null;
    },
  },
  async (ctx) => {
    const body = parseInput(validateCreateProveedor, await readJsonBody(ctx.req));

    const { data, error } = await proveedorService.create(ctx.supabase, body);

    if (error) return ctx.fail(error);
    if (!data) return ctx.fail(new Error("No se pudo crear el proveedor"));

    return Response.json(
      {
        data: mapProveedor(data),
        error: null,
      } satisfies CreateProveedorResponse,
      { status: 201 }
    );
  }
);
