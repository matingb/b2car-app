"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { StockMovement } from "@/model/stock";
import { productosClient, mapProductoDetailToInventario, mapProductoToInventario, mapStockDtoToInventario } from "@/clients/productosClient";
import { stocksClient } from "@/clients/stocksClient";
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

export type Producto = {
  id: string;
  nombre: string;
  codigo: string;
  categorias: string[];
  talleresConStock: number;
  precioUnitario: number;
  costoUnitario: number;
  proveedor: string;
  showInStock: boolean;
  stocks: StockRegistro[];
};

export type CreateProductoInput = Omit<Producto, "id" | "talleresConStock" | "showInStock" | "stocks"> & { id?: string };
export type UpdateProductoInput = Partial<Omit<Producto, "id" | "talleresConStock" | "showInStock" | "stocks">>;
export type SaveProductoStockInput = {
  stockId?: string;
  productoId: string;
  tallerId: string;
  stockActual: number;
  stockMinimo: number;
  stockMaximo: number;
};

export type SaveProductoStockResult = {
  stock: StockRegistro | null;
  error: string | null;
  status?: number;
};

export type CreateProductoResult = { producto: Producto | null; error: string | null };

type ProductosContextType = {
  isLoading: boolean;
  categoriasDisponibles: readonly string[];
  productos: Producto[];
  loadProductos: () => Promise<void>;
  getProductoById: (productoId: string) => Promise<{ producto: Producto; stocks: StockRegistro[] } | null>; 
  createProducto: (input: CreateProductoInput) => Promise<CreateProductoResult>;
  updateProducto: (productoId: string, input: UpdateProductoInput) => Promise<Producto | null>;
  updateShowInStock: (productoId: string, showInStock: boolean) => Promise<boolean>;
  saveProductoStock: (input: SaveProductoStockInput) => Promise<SaveProductoStockResult>;
  removeProductoStock: (stockId: string) => Promise<boolean>;
  removeProducto: (productoId: string) => Promise<void>;
};

const ProductosContext = createContext<ProductosContextType | null>(null);

function getResponseStatus(res: unknown): number | undefined {
  if (!res || typeof res !== "object" || !("status" in res)) return undefined;
  const status = (res as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
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

  const mapProductoStockToRegistro = (s: StockDTO): StockRegistro => mapStockDtoToInventario(s);

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

  const updateShowInStock = useCallback(async (productoId: string, showInStock: boolean): Promise<boolean> => {
    try {
      const res = await productosClient.update(productoId, { show_in_stock: showInStock });
      return !res.error;
    } catch {
      return false;
    }
  }, []);

  const saveProductoStock = useCallback(async (input: SaveProductoStockInput): Promise<SaveProductoStockResult> => {
    setIsLoading(true);
    try {
      const payload = {
        cantidad: input.stockActual,
        stock_minimo: input.stockMinimo,
        stock_maximo: input.stockMaximo,
      };
      const res = input.stockId
        ? await stocksClient.update(input.stockId, payload)
        : await stocksClient.upsert({
            productoId: input.productoId,
            tallerId: input.tallerId,
            ...payload,
          });

      if (!res.data) {
        return {
          stock: null,
          error: res.error ?? "No se pudo guardar el stock",
          status: getResponseStatus(res),
        };
      }

      return { stock: mapStockDtoToInventario(res.data), error: null, status: getResponseStatus(res) };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeProductoStock = useCallback(async (stockId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const res = await stocksClient.delete(stockId);
      return !res.error;
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      updateShowInStock,
      saveProductoStock,
      removeProductoStock,
      removeProducto,
    }),
    [isLoading, productos, loadProductos, getProductoById, createProducto, updateProducto, updateShowInStock, saveProductoStock, removeProductoStock, removeProducto]
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

