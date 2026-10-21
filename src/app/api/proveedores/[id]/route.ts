import { createApiHandler } from "../../apiHandler";
import { parseInput, readJsonBody, uuidParams, type Validated } from "../../apiInput";
import { proveedorService, type ProveedorRow, type UpdateProveedorInput } from "../proveedorService";
import { Permission } from "@/lib/permissions";
import { ServiceError } from "../../serviceError";
import type { Proveedor } from "@/model/types";

export type GetProveedorResponse = {
  data: Proveedor | null;
  error?: string | null;
};

export type UpdateProveedorRequest = Partial<{
  nombre: string;
  cuit: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
}>;

export type UpdateProveedorResponse = {
  data: Proveedor | null;
  error?: string | null;
};

export type DeleteProveedorResponse = {
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

function validateUpdateProveedor(raw: unknown): Validated<UpdateProveedorInput> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "JSON inválido" };
  }
  const obj = raw as Record<string, unknown>;
  const patch: UpdateProveedorInput = {};

  if (obj.nombre !== undefined) {
    const nombre = String(obj.nombre ?? "").trim();
    if (!nombre) return { error: "El nombre no puede estar vacío" };
    patch.nombre = nombre;
  }
  if (obj.cuit !== undefined) {
    patch.cuit = obj.cuit === null ? null : String(obj.cuit).trim();
  }
  if (obj.telefono !== undefined) {
    patch.telefono = obj.telefono === null ? null : String(obj.telefono).trim();
  }
  if (obj.email !== undefined) {
    patch.email = obj.email === null ? null : String(obj.email).trim();
  }
  if (obj.direccion !== undefined) {
    patch.direccion = obj.direccion === null ? null : String(obj.direccion).trim();
  }

  return { value: patch };
}

export const GET = createApiHandler(
  {
    route: "GET /api/proveedores/[id]",
    permission: Permission.ProveedoresView,
    fallback: "Error al obtener proveedor",
    mapError: (err) => {
      if (err === ServiceError.NotFound) {
        return { status: 404, code: "NOT_FOUND", message: "Proveedor no encontrado" };
      }
      return null;
    },
  },
  async (ctx) => {
    const { id } = parseInput(uuidParams("id"), ctx.params);
    const { data, error } = await proveedorService.getById(ctx.supabase, id);

    if (error) return ctx.fail(error);
    if (!data) return ctx.fail(ServiceError.NotFound);

    return Response.json({
      data: mapProveedor(data),
      error: null,
    } satisfies GetProveedorResponse);
  }
);

export const PUT = createApiHandler(
  {
    route: "PUT /api/proveedores/[id]",
    permission: Permission.ProveedoresEdit,
    fallback: "Error al actualizar proveedor",
    mapError: (err) => {
      if (err === ServiceError.NotFound) {
        return { status: 404, code: "NOT_FOUND", message: "Proveedor no encontrado" };
      }
      if (err === ServiceError.Conflict) {
        return { status: 409, code: "CONFLICT", message: "Ya existe un proveedor con ese CUIT" };
      }
      return null;
    },
  },
  async (ctx) => {
    const { id } = parseInput(uuidParams("id"), ctx.params);
    const body = parseInput(validateUpdateProveedor, await readJsonBody(ctx.req));

    const { data, error } = await proveedorService.updateById(ctx.supabase, id, body);

    if (error) return ctx.fail(error);
    if (!data) return ctx.fail(ServiceError.NotFound);

    return Response.json({
      data: mapProveedor(data),
      error: null,
    } satisfies UpdateProveedorResponse);
  }
);

export const DELETE = createApiHandler(
  {
    route: "DELETE /api/proveedores/[id]",
    permission: Permission.ProveedoresEdit,
    fallback: "Error al eliminar proveedor",
    mapError: (err) => {
      if (err === ServiceError.NotFound) {
        return { status: 404, code: "NOT_FOUND", message: "Proveedor no encontrado" };
      }
      if (err === ServiceError.EnUso) {
        return { status: 409, code: "CONFLICT", message: "No se puede eliminar el proveedor porque tiene operaciones asociadas" };
      }
      return null;
    },
  },
  async (ctx) => {
    const { id } = parseInput(uuidParams("id"), ctx.params);
    const { error } = await proveedorService.deleteById(ctx.supabase, id);

    if (error) return ctx.fail(error);

    return Response.json({ error: null } satisfies DeleteProveedorResponse);
  }
);
