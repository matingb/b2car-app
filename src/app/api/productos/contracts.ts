import type { ProductoDTO, ProductoDetailDTO } from "@/model/dtos";

export type GetProductosResponse = {
  data: ProductoDTO[] | null;
  error?: string | null;
};

export type CreateProductoRequest = {
  codigo: string;
  nombre: string;
  marca?: string;
  modelo?: string;
  descripcion?: string;
  precio_unitario: number;
  costo_unitario: number;
  proveedor?: string;
  categorias?: string[];
};

export type CreateProductoResponse = {
  data: ProductoDTO | null;
  error?: string | null;
};

export type GetProductoByIdResponse = {
  data: ProductoDetailDTO | null;
  error?: string | null;
};

export type UpdateProductoRequest = Partial<{
  codigo: string;
  nombre: string;
  marca: string | null;
  modelo: string | null;
  descripcion: string | null;
  precio_unitario: number;
  costo_unitario: number;
  proveedor: string | null;
  categorias: string[];
}>;

export type UpdateProductoResponse = {
  data: ProductoDetailDTO | null;
  error?: string | null;
};

