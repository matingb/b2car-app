import type { Proveedor } from "@/model/types";
import { API_ROUTES } from "@/routing/routes";

export type GetProveedoresInput = {
  search?: string;
  limit?: number;
};

export type ProveedoresClientResponse<T> = {
  data: T | null;
  error?: string | null;
};

export const proveedoresClient = {
  async getAll(params?: GetProveedoresInput): Promise<ProveedoresClientResponse<Proveedor[]>> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.set("search", params.search);
      if (params?.limit) searchParams.set("limit", String(params.limit));

      const query = searchParams.toString();
      const url = query ? `${API_ROUTES.proveedores}?${query}` : API_ROUTES.proveedores;

      const res = await fetch(url);
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }

      return { data: body?.data ?? [], error: null };
    } catch (err: unknown) {
      return {
        data: null,
        error: err instanceof Error ? err.message : "Error de red al obtener proveedores",
      };
    }
  },

  async getById(id: string): Promise<ProveedoresClientResponse<Proveedor>> {
    try {
      const res = await fetch(`${API_ROUTES.proveedores}/${id}`);
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }

      return { data: body?.data ?? null, error: null };
    } catch (err: unknown) {
      return {
        data: null,
        error: err instanceof Error ? err.message : "Error de red al obtener proveedor",
      };
    }
  },

  async create(data: {
    nombre: string;
    cuit?: string | null;
    telefono?: string | null;
    email?: string | null;
    direccion?: string | null;
  }): Promise<ProveedoresClientResponse<Proveedor>> {
    try {
      const res = await fetch(API_ROUTES.proveedores, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }

      return { data: body?.data ?? null, error: null };
    } catch (err: unknown) {
      return {
        data: null,
        error: err instanceof Error ? err.message : "Error de red al crear proveedor",
      };
    }
  },

  async update(
    id: string,
    data: Partial<{
      nombre: string;
      cuit?: string | null;
      telefono?: string | null;
      email?: string | null;
      direccion?: string | null;
    }>
  ): Promise<ProveedoresClientResponse<Proveedor>> {
    try {
      const res = await fetch(`${API_ROUTES.proveedores}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }

      return { data: body?.data ?? null, error: null };
    } catch (err: unknown) {
      return {
        data: null,
        error: err instanceof Error ? err.message : "Error de red al actualizar proveedor",
      };
    }
  },

  async delete(id: string): Promise<ProveedoresClientResponse<boolean>> {
    try {
      const res = await fetch(`${API_ROUTES.proveedores}/${id}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }

      return { data: true, error: null };
    } catch (err: unknown) {
      return {
        data: null,
        error: err instanceof Error ? err.message : "Error de red al eliminar proveedor",
      };
    }
  },
};
