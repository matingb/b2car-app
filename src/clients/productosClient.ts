import type {
  ProductoDTO,
  ProductoDetailDTO,
} from "@/model/dtos";
import type {
  CreateProductoRequest,
  CreateProductoResponse,
  GetProductoByIdResponse,
  GetProductosResponse,
  UpdateProductoRequest,
  UpdateProductoResponse,
} from "@/app/api/productos/contracts";

export const productosClient = {
  async getAll(): Promise<GetProductosResponse> {
    try {
      const res = await fetch(`/api/productos`);
      const body: GetProductosResponse = await res.json();
      if (!res.ok) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data || [], error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error cargando productos";
      return { data: null, error: message };
    }
  },

  async getById(id: string): Promise<GetProductoByIdResponse> {
    try {
      const res = await fetch(`/api/productos/${id}`);
      const body: GetProductoByIdResponse = await res.json();
      if (!res.ok) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data || null, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error cargando producto";
      return { data: null, error: message };
    }
  },

  async create(input: CreateProductoRequest): Promise<CreateProductoResponse> {
    try {
      const res = await fetch("/api/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body: CreateProductoResponse = await res.json().catch(() => ({ data: null, error: `Error ${res.status}` }));
      if (!res.ok || body?.error) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data || null, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo crear el producto";
      return { data: null, error: message };
    }
  },

  async update(id: string, input: UpdateProductoRequest): Promise<UpdateProductoResponse> {
    try {
      const res = await fetch(`/api/productos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body: UpdateProductoResponse = await res.json().catch(() => ({ data: null, error: `Error ${res.status}` }));
      if (!res.ok || body?.error) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data || null, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar el producto";
      return { data: null, error: message };
    }
  },

  async delete(id: string): Promise<{ error?: string | null }> {
    try {
      const res = await fetch(`/api/productos/${id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.error) {
        return { error: body?.error || `Error ${res.status}` };
      }
      return { error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo eliminar el producto";
      return { error: message };
    }
  },
};

export function mapProductoToInventario(dto: ProductoDTO) {
  return {
    productoId: dto.id,
    nombre: dto.nombre,
    codigo: dto.codigo,
    categorias: dto.categorias ?? [],
    // Frontend mapping
    precioVenta: dto.precio_unitario ?? 0,
    precioCompra: dto.costo_unitario ?? 0,
    proveedor: dto.proveedor ?? "",
    // A falta de columna ubicación en el schema: usamos vacío (UI muestra "-")
    ubicacion: "",
  };
}

export function mapProductoDetailToInventario(dto: ProductoDetailDTO) {
  return mapProductoToInventario(dto as unknown as ProductoDTO);
}

