import type {
  ProductoDTO,
  ProductoDetailDTO,
  StockDTO,
} from "@/model/dtos";
import type {
  CreateProductoRequest,
  CreateProductoResponse,
  GetProductoByIdResponse,
  GetProductosResponse,
  UpdateProductoRequest,
  UpdateProductoResponse,
} from "@/app/api/productos/contracts";
import type { Producto, StockRegistro } from "@/app/providers/ProductosProvider";

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

export function mapProductoToInventario(dto: ProductoDTO): Producto {
  return {
    id: dto.id,
    nombre: dto.nombre,
    codigo: dto.codigo,
    categorias: dto.categorias ?? [],
    precioUnitario: dto.precio_unitario ?? 0,
    costoUnitario: dto.costo_unitario ?? 0,
    proveedor: dto.proveedor ?? "",
    talleresConStock: dto.talleresConStock ?? 0,
    showInStock: dto.show_in_stock,
    stocks: (dto.stocks ?? []).map(mapStockDtoToInventario),
  };
}

export function mapProductoDetailToInventario(dto: ProductoDetailDTO) {
  return mapProductoToInventario({
    ...(dto as unknown as ProductoDTO),
    talleresConStock: dto.stocks?.length ?? 0,
    stocks: dto.stocks ?? [],
  });
}

export function mapStockDtoToInventario(s: StockDTO): StockRegistro {
  return {
    id: s.id,
    productoId: s.productoId,
    tallerId: s.tallerId,
    stockActual: Number(s.cantidad) || 0,
    stockMinimo: Number(s.stock_minimo) || 0,
    stockMaximo: Number(s.stock_maximo) || 0,
    ultimaActualizacion: isoToShortEsDate(s.updated_at),
    historialMovimientos: [],
  };
}

function formatShortEsDate(d: Date) {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear());
  return `${day}/${month}/${year}`;
}

function isoToShortEsDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatShortEsDate(d);
}

