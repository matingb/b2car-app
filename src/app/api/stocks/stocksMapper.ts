import type { ProductoDTO, StockDTO, StockItemDTO } from "@/model/dtos";
import type { StockRow, StockItemRow } from "./stocksService";
import type { ProductoRow } from "../productos/productosService";

export type ProductoJoinRow = ProductoRow & { provedor?: string | null };

export function mapStockRow(row: StockRow): StockDTO {
  return {
    id: row.id,
    tallerId: row.taller_id,
    productoId: row.producto_id,
    cantidad: Number(row.cantidad) || 0,
    cantidad_reservada: Number(row.cantidad_reservada) || 0,
    cantidad_pendiente: Number(row.cantidad_pendiente) || 0,
    cantidad_disponible:
      row.cantidad_disponible !== undefined && row.cantidad_disponible !== null
        ? Number(row.cantidad_disponible)
        : (Number(row.cantidad) || 0) - (Number(row.cantidad_reservada) || 0),
    stock_minimo: Number(row.stock_minimo) || 0,
    stock_maximo: Number(row.stock_maximo) || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapProducto(row: ProductoJoinRow | null): ProductoDTO | null {
  if (!row) return null;
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    marca: row.marca ?? null,
    modelo: row.modelo ?? null,
    descripcion: row.descripcion ?? null,
    precio_unitario: Number(row.precio_unitario) || 0,
    costo_unitario: Number(row.costo_unitario) || 0,
    proveedor: row.proveedor ?? row.provedor ?? null,
    categorias: Array.isArray(row.categorias) ? row.categorias : [],
    show_in_stock: row.show_in_stock,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapStockItemRow(row: StockItemRow): StockItemDTO {
  return {
    ...mapStockRow(row),
    producto: mapProducto(row.productos ?? null),
  };
}

