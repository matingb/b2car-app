"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { StockMovement } from "@/model/stock";
import { productosClient, mapProductoDetailToInventario, mapProductoToInventario } from "@/clients/productosClient";
import type { ProductoDetailDTO, StockDTO } from "@/model/dtos";

export const INVENTARIO_CATEGORIAS_DISPONIBLES = [
  "Aceites y Lubricantes",
  "Filtros",
  "Frenos",
  "Suspensión",
  "Motor",
  "Eléctrico",
  "Carrocería",
  "Neumáticos",
  "Herramientas",
  "Accesorios",
] as const;

export type Producto = {
  id: string;
  nombre: string;
  codigo: string;
  categorias: string[];
  talleresConStock: number;
  precioUnitario: number;
  costoUnitario: number;
  proveedor: string;
  ubicacion: string;
};

export type StockRegistro = {
  id: string;
  productoId: string;
  tallerId: string;
  stockActual: number;
  stockMinimo: number;
  stockMaximo: number;
  ultimaActualizacion: string;
  historialMovimientos: StockMovement[];
};

export type CreateProductoInput = Omit<Producto, "id" | "talleresConStock"> & { id?: string };
export type UpdateProductoInput = Partial<Omit<Producto, "id" | "talleresConStock">>;

export type CreateProductoResult = { producto: Producto | null; error: string | null };

type ProductosContextType = {
  isLoading: boolean;
  categoriasDisponibles: readonly string[];
  productos: Producto[];
  loadProductos: () => Promise<void>;
  getProductoById: (productoId: string) => Promise<{ producto: Producto; stocks: StockRegistro[] } | null>; 
  createProducto: (input: CreateProductoInput) => Promise<CreateProductoResult>;
  updateProducto: (productoId: string, input: UpdateProductoInput) => Promise<Producto | null>;
  removeProducto: (productoId: string) => Promise<void>;
};

const ProductosContext = createContext<ProductosContextType | null>(null);

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

export function ProductosProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);

  const loadProductos = useCallback(async () => {
    setIsLoading(true);
    try {
      const productosRes = await productosClient.getAll();
      if (productosRes.error || !productosRes.data) {
        setProductos([]);
      } else {
        setProductos(productosRes.data.map(mapProductoToInventario));
      }

    } finally {
      setIsLoading(false);
    }
  }, []);

  const mapProductoDetailToUi = (dto: ProductoDetailDTO): Producto => {
    return mapProductoDetailToInventario(dto);
  };

  const mapProductoStockToRegistro = (s: StockDTO): StockRegistro => {
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
  };

  const getProductoById = useCallback(
    async (productoId: string) => {
      const id = String(productoId ?? "").trim();
      if (!id) return null;
      setIsLoading(true);
      try {
        const res = await productosClient.getById(id);
        if (!res.data) return null;
        const dto = res.data as ProductoDetailDTO;
        return {
          producto: mapProductoDetailToUi(dto),
          stocks: (dto.stocks ?? []).map(mapProductoStockToRegistro),
        };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const createProducto = useCallback(async (input: CreateProductoInput): Promise<CreateProductoResult> => {
    setIsLoading(true);
    try {
      const res = await productosClient.create({
        codigo: input.codigo.trim(),
        nombre: input.nombre.trim(),
        precio_unitario: input.precioUnitario ?? 0,
        costo_unitario: input.costoUnitario ?? 0,
        proveedor: input.proveedor ?? "",
        categorias: input.categorias ?? [],
      });
      if (!res.data) return { producto: null, error: res.error ?? "No se pudo crear el producto" };
      await loadProductos();
      return { producto: mapProductoToInventario(res.data), error: null };
    } finally {
      setIsLoading(false);
    }
  }, [loadProductos]);

  const updateProducto = useCallback(async (productoId: string, input: UpdateProductoInput) => {
    setIsLoading(true);
    try {
      const res = await productosClient.update(productoId, {
        codigo: input.codigo,
        nombre: input.nombre,
        proveedor: input.proveedor ?? null,
        categorias: input.categorias,
        precio_unitario: input.precioUnitario,
        costo_unitario: input.costoUnitario,
      });
      if (!res.data) return null;
      await loadProductos();
      return mapProductoDetailToInventario(res.data as unknown as ProductoDetailDTO);
    } finally {
      setIsLoading(false);
    }
  }, [loadProductos]);

  const removeProducto = useCallback(async (productoId: string) => {
    setIsLoading(true);
    try {
      await productosClient.delete(productoId);
      await loadProductos();
    } finally {
      setIsLoading(false);
    }
  }, [loadProductos]);

  const value = useMemo<ProductosContextType>(
    () => ({
      isLoading,
      categoriasDisponibles: INVENTARIO_CATEGORIAS_DISPONIBLES as readonly string[],
      productos,
      loadProductos,
      getProductoById,
      createProducto,
      updateProducto,
      removeProducto,
    }),
    [isLoading, productos, loadProductos, getProductoById, createProducto, updateProducto, removeProducto]
  );

  useEffect(() => {
    void loadProductos();
  }, [loadProductos]);

  return <ProductosContext.Provider value={value}>{children}</ProductosContext.Provider>;
}

export function useProductos() {
  const ctx = useContext(ProductosContext);
  if (!ctx) throw new Error("useProductos debe usarse dentro de ProductosProvider");
  return ctx;
}

