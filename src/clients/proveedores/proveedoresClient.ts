import type { Proveedor } from "@/model/types";
import type { ProductoProveedorDTO, ProveedorCuentaCorrienteResumen, ProveedorOperacionItemDTO } from "@/model/dtos";
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

  async getProductos(proveedorId: string): Promise<ProveedoresClientResponse<ProductoProveedorDTO[]>> {
    try {
      const res = await fetch(`${API_ROUTES.proveedores}/${proveedorId}/productos`);
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }

      return { data: body?.data ?? [], error: null };
    } catch (err: unknown) {
      return {
        data: null,
        error: err instanceof Error ? err.message : "Error de red al obtener productos del proveedor",
      };
    }
  },

  async asociarProducto(
    proveedorId: string,
    data: {
      producto_id: string;
      codigo_proveedor?: string | null;
      costo_referencia?: number;
      es_predeterminado?: boolean;
    }
  ): Promise<ProveedoresClientResponse<ProductoProveedorDTO>> {
    try {
      const res = await fetch(`${API_ROUTES.proveedores}/${proveedorId}/productos`, {
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
        error: err instanceof Error ? err.message : "Error de red al asociar producto",
      };
    }
  },

  async desvincularProducto(
    proveedorId: string,
    productoId: string
  ): Promise<ProveedoresClientResponse<boolean>> {
    try {
      const res = await fetch(`${API_ROUTES.proveedores}/${proveedorId}/productos/${productoId}`, {
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
        error: err instanceof Error ? err.message : "Error de red al desvincular producto",
      };
    }
  },

  async actualizarProductoVinculado(
    proveedorId: string,
    productoId: string,
    data: {
      codigo_proveedor?: string | null;
      costo_referencia?: number;
      es_predeterminado?: boolean;
    }
  ): Promise<ProveedoresClientResponse<ProductoProveedorDTO>> {
    try {
      const res = await fetch(`${API_ROUTES.proveedores}/${proveedorId}/productos/${productoId}`, {
        method: "PATCH",
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
        error: err instanceof Error ? err.message : "Error de red al actualizar producto vinculado",
      };
    }
  },

  async getOperaciones(
    proveedorId: string
  ): Promise<ProveedoresClientResponse<ProveedorCuentaCorrienteResumen>> {
    try {
      const res = await fetch(`${API_ROUTES.proveedores}/${proveedorId}/operaciones`);
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }

      return { data: body?.data ?? null, error: null };
    } catch (err: unknown) {
      return {
        data: null,
        error: err instanceof Error ? err.message : "Error de red al obtener operaciones del proveedor",
      };
    }
  },
};
