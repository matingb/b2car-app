"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { StockItem, StockMovement } from "@/model/stock";
import { useTenant } from "@/app/providers/TenantProvider";
import { productosClient, mapProductoDetailToInventario, mapProductoToInventario } from "@/clients/productosClient";
import { stocksClient, mapStockItemToInventario } from "@/clients/stocksClient";

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
  productoId: string;
  nombre: string;
  codigo: string;
  categorias: string[];
  precioCompra: number;
  precioVenta: number;
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

export type CreateProductoInput = Omit<Producto, "productoId"> & { productoId?: string };

export type UpdateProductoInput = Partial<Omit<Producto, "productoId">>;

export type UpsertStockInput = {
  productoId: string;
  tallerId: string;
  stockActual?: number;
  stockMinimo?: number;
  stockMaximo?: number;
};

type InventarioContextType = {
  loading: boolean;
  categoriasDisponibles: readonly string[];

  productos: Producto[];
  stockRegistros: StockRegistro[];

  getStockItemsForTaller: (tallerId: string) => StockItem[];
  getProductoById: (productoId: string) => Producto | null;
  getStockForProducto: (productoId: string) => StockRegistro[];

  createProducto: (input: CreateProductoInput) => Promise<Producto | null>;
  updateProducto: (productoId: string, input: UpdateProductoInput) => Promise<Producto | null>;
  removeProducto: (productoId: string) => Promise<void>;

  upsertStock: (input: UpsertStockInput) => Promise<StockRegistro | null>;
  updateStock: (id: string, patch: Partial<Omit<StockRegistro, "id" | "productoId" | "tallerId">>) => Promise<StockRegistro | null>;
  removeStock: (id: string) => Promise<void>;
};

const InventarioContext = createContext<InventarioContextType | null>(null);

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

export function InventarioProvider({ children }: { children: React.ReactNode }) {
  const { talleres } = useTenant();
  const [loading, setLoading] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [stockRegistros, setStockRegistros] = useState<StockRegistro[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const productosRes = await productosClient.getAll();
        if (cancelled) return;
        if (productosRes.error || !productosRes.data) {
          setProductos([]);
        } else {
          setProductos(productosRes.data.map(mapProductoToInventario));
        }

        const stocksRes = await stocksClient.getAll();
        if (cancelled) return;
        if (stocksRes.error || !stocksRes.data) {
          setStockRegistros([]);
        } else {
          const allStocks: StockRegistro[] = stocksRes.data.map((dto) => {
            const mapped = mapStockItemToInventario(dto);
            return {
              ...mapped,
              ultimaActualizacion: isoToShortEsDate(mapped.ultimaActualizacion),
              historialMovimientos: [],
            };
          });
          setStockRegistros(allStocks);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [talleres]);

  const getProductoById = useCallback(
    (productoId: string) => {
      return productos.find((p) => p.productoId === productoId) ?? null;
    },
    [productos]
  );

  const getStockForProducto = useCallback(
    (productoId: string) => {
      return stockRegistros.filter((s) => s.productoId === productoId);
    },
    [stockRegistros]
  );

  const getStockItemsForTaller = useCallback(
    (tallerId: string): StockItem[] => {
      const regs = stockRegistros.filter((s) => s.tallerId === tallerId);
      return regs
        .map((s) => {
          const p = productos.find((x) => x.productoId === s.productoId);
          if (!p) return null;
          return {
            id: s.id,
            productoId: s.productoId,
            tallerId: s.tallerId,
            nombre: p.nombre,
            codigo: p.codigo,
            categorias: p.categorias,
            stockActual: s.stockActual,
            stockMinimo: s.stockMinimo,
            stockMaximo: s.stockMaximo,
            precioCompra: p.precioCompra,
            precioVenta: p.precioVenta,
            proveedor: p.proveedor,
            ubicacion: p.ubicacion,
            ultimaActualizacion: s.ultimaActualizacion,
            historialMovimientos: s.historialMovimientos,
          };
        })
        .filter(Boolean) as StockItem[];
    },
    [productos, stockRegistros]
  );

  const createProducto = useCallback(
    async (input: CreateProductoInput) => {
      setLoading(true);
      try {
        const res = await productosClient.create({
          codigo: input.codigo.trim(),
          nombre: input.nombre.trim(),
          precio_unitario: input.precioVenta ?? 0,
          costo_unitario: input.precioCompra ?? 0,
          proveedor: input.proveedor ?? "",
          categorias: input.categorias ?? [],
        });
        if (!res.data) return null;
        const nuevo = mapProductoToInventario(res.data);
        setProductos((prev) => [...prev, nuevo]);
        return nuevo;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateProducto = useCallback(
    async (productoId: string, input: UpdateProductoInput) => {
      setLoading(true);
      try {
        const res = await productosClient.update(productoId, {
          codigo: input.codigo,
          nombre: input.nombre,
          proveedor: input.proveedor ?? null,
          categorias: input.categorias,
          precio_unitario: input.precioVenta,
          costo_unitario: input.precioCompra,
        });
        if (!res.data) return null;
        const updatedProducto = mapProductoDetailToInventario(res.data);
        setProductos((prev) =>
          prev.map((p) => (p.productoId === productoId ? { ...p, ...updatedProducto } : p))
        );
        return updatedProducto;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const removeProducto = useCallback(async (productoId: string) => {
    setLoading(true);
    try {
      await productosClient.delete(productoId);
      setProductos((prev) => prev.filter((p) => p.productoId !== productoId));
      setStockRegistros((prev) => prev.filter((s) => s.productoId !== productoId));
    } finally {
      setLoading(false);
    }
  }, []);

  const upsertStock = useCallback(
    async (input: UpsertStockInput) => {
      setLoading(true);
      try {
        const res = await stocksClient.upsert({
          tallerId: input.tallerId,
          productoId: input.productoId,
          cantidad: input.stockActual,
          stock_minimo: input.stockMinimo,
          stock_maximo: input.stockMaximo,
        });
        if (!res.data) return null;
        const updatedAt = isoToShortEsDate(res.data.updated_at);
        const id = res.data.id;
        const next: StockRegistro = {
          id,
          productoId: res.data.productoId,
          tallerId: res.data.tallerId,
          stockActual: res.data.cantidad,
          stockMinimo: res.data.stock_minimo,
          stockMaximo: res.data.stock_maximo,
          ultimaActualizacion: updatedAt,
          historialMovimientos: [],
        };
        setStockRegistros((prev) => {
          const exists = prev.some((s) => s.id === id);
          return exists ? prev.map((s) => (s.id === id ? next : s)) : [...prev, next];
        });
        return next;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateStock = useCallback(async (id: string, patch: Partial<Omit<StockRegistro, "id" | "productoId" | "tallerId">>) => {
    setLoading(true);
    try {
      const res = await stocksClient.update(id, {
        cantidad: patch.stockActual,
        stock_minimo: patch.stockMinimo,
        stock_maximo: patch.stockMaximo,
      });
      if (!res.data) return null;
      const nextUpdatedAt = isoToShortEsDate(res.data.updated_at);
      let updated: StockRegistro | null = null;
      setStockRegistros((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          updated = {
            ...s,
            stockActual: res.data!.cantidad,
            stockMinimo: res.data!.stock_minimo,
            stockMaximo: res.data!.stock_maximo,
            ultimaActualizacion: nextUpdatedAt,
          };
          return updated;
        })
      );
      return updated;
    } finally {
      setLoading(false);
    }
  }, []);

  const removeStock = useCallback(async (id: string) => {
    setLoading(true);
    try {
      await stocksClient.delete(id);
      setStockRegistros((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo<InventarioContextType>(
    () => ({
      loading,
      categoriasDisponibles: INVENTARIO_CATEGORIAS_DISPONIBLES as readonly string[],
      productos,
      stockRegistros,
      getStockItemsForTaller,
      getProductoById,
      getStockForProducto,
      createProducto,
      updateProducto,
      removeProducto,
      upsertStock,
      updateStock,
      removeStock,
    }),
    [
      loading,
      productos,
      stockRegistros,
      getStockItemsForTaller,
      getProductoById,
      getStockForProducto,
      createProducto,
      updateProducto,
      removeProducto,
      upsertStock,
      updateStock,
      removeStock,
    ]
  );

  return <InventarioContext.Provider value={value}>{children}</InventarioContext.Provider>;
}

export function useInventario() {
  const ctx = useContext(InventarioContext);
  if (!ctx) throw new Error("useInventario debe usarse dentro de InventarioProvider");
  return ctx;
}

