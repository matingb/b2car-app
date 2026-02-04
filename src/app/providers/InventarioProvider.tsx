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
import type { StockItemDTO } from "@/model/dtos";
import { stocksClient } from "@/clients/stocksClient";
import { logger } from "@/lib/logger";

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
  precioUnitario: number;
  costoUnitario: number;
  proveedor: string;
  ubicacion: string;
  talleresConStock: number;
};

export type Stock = {
  id: string;
  tallerId: string;
  stockActual: number;
  stockMinimo: number;
  stockMaximo: number;
  ultimaActualizacion: string;
  historialMovimientos: StockMovement[];
};

export type CreateProductoInput = Omit<Producto, "id"> & { id?: string };

export type UpdateProductoInput = Partial<Omit<Producto, "id">>;

export type UpsertStockInput = {
  productoId: string;
  tallerId: string;
  stockActual?: number;
  stockMinimo?: number;
  stockMaximo?: number;
};

type InventarioContextType = {
  isLoading: boolean;
  inventario: StockItem[];
  loadInventarioByTaller: (tallerId: string) => Promise<void>;
  getStockById: (id: string) => Promise<StockItem | null>;

  upsertStock: (input: UpsertStockInput) => Promise<Stock | null>;
  updateStock: (id: string, patch: Partial<Omit<Stock, "id" | "productoId" | "tallerId">>) => Promise<Stock | null>;
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
  const [isLoading, setIsLoading] = useState(false);
  const [inventario, setInventario] = useState<StockItem[]>([]);

  const mapStockItemDtoToUi = useCallback((dto: StockItemDTO): StockItem | null => {
    const p = dto.producto;
    if (!p) return null;
    return {
      id: dto.id,
      productoId: dto.productoId,
      tallerId: dto.tallerId,
      nombre: p.nombre ?? dto.productoId,
      codigo: p.codigo ?? "",
      categorias: p.categorias ?? [],
      stockActual: Number(dto.cantidad) || 0,
      stockMinimo: Number(dto.stock_minimo) || 0,
      stockMaximo: Number(dto.stock_maximo) || 0,
      costoUnitario: Number(p.costo_unitario) || 0,
      precioUnitario: Number(p.precio_unitario) || 0,
      proveedor: p.proveedor ?? "",
      ubicacion: "",
      ultimaActualizacion: isoToShortEsDate(dto.updated_at),
      historialMovimientos: [],
    };
  }, []);

  const loadInventarioByTaller = useCallback(
    async (tallerId: string) => {
      const id = String(tallerId ?? "").trim();
      if (!id) return;
      setIsLoading(true);
      try {
        const stocksRes = await stocksClient.getByTaller({ tallerId: id });
        logger.debug("Stocks response:", stocksRes);
        if (stocksRes.error || !stocksRes.data) {
          setInventario([]);
          return;
        }
        const items = stocksRes.data
          .map(mapStockItemDtoToUi) as StockItem[];
        setInventario(items);
      } finally {
        setIsLoading(false);
      }
    },
    [mapStockItemDtoToUi]
  );

  const getStockById = useCallback(
    async (id: string) => {
      const stockId = String(id ?? "").trim();
      if (!stockId) return null;
      setIsLoading(true);
      try {
        const res = await stocksClient.getById(stockId);
        if (!res.data) return null;
        return mapStockItemDtoToUi(res.data as unknown as StockItemDTO);
      } finally {
        setIsLoading(false);
      }
    },
    [mapStockItemDtoToUi]
  );

  const upsertStock = useCallback(
    async (input: UpsertStockInput): Promise<StockItem | null> => {
      setIsLoading(true);
      try {
        const res = await stocksClient.upsert({
          tallerId: input.tallerId,
          productoId: input.productoId,
          cantidad: input.stockActual,
          stock_minimo: input.stockMinimo,
          stock_maximo: input.stockMaximo,
        });
        logger.debug("Upsert stock response:", res);
        if (!res.data) {
          throw new Error(res.error || "No se pudo guardar el stock");
        }
        await loadInventarioByTaller(input.tallerId);
        return mapStockItemDtoToUi(res.data as StockItemDTO);
      } finally {
        setIsLoading(false);
      }
    },
    [loadInventarioByTaller, mapStockItemDtoToUi]
  );

  const updateStock = useCallback(
    async (id: string, patch: Partial<Omit<Stock, "id" | "productoId" | "tallerId">>): Promise<StockItem | null> => {
      setIsLoading(true);
      try {
        const res = await stocksClient.update(id, {
          cantidad: patch.stockActual,
          stock_minimo: patch.stockMinimo,
          stock_maximo: patch.stockMaximo,
        });

        if (!res.data) {
          throw new Error(res.error || "No se pudo actualizar el stock");
        }

        await loadInventarioByTaller(res.data.tallerId);
        return mapStockItemDtoToUi(res.data as StockItemDTO);
      } finally {
        setIsLoading(false);
      }
    },
    [loadInventarioByTaller, mapStockItemDtoToUi]
  );

  const removeStock = useCallback(async (id: string): Promise<void> => {
    setIsLoading(true);
    try {
      await stocksClient.delete(id);
      const current = inventario.find((item) => item.id === id);
      if (current?.tallerId) {
        await loadInventarioByTaller(current.tallerId);
      }
    } finally {
      setIsLoading(false);
    }
  }, [inventario, loadInventarioByTaller]);

  const value = useMemo<InventarioContextType>(
    () => ({
      isLoading,
      inventario,
      loadInventarioByTaller,
      getStockById,
      upsertStock,
      updateStock,
      removeStock,
    }),
    [
      isLoading,
      inventario,
      loadInventarioByTaller,
      getStockById,
      upsertStock,
      updateStock,
      removeStock,
    ]
  );

  return <InventarioContext.Provider value={value}>{children}</InventarioContext.Provider>;
}

export function useInventario(tallerId?: string) {
  const ctx = useContext(InventarioContext);
  if (!ctx) throw new Error("useInventario debe usarse dentro de InventarioProvider");
  const { loadInventarioByTaller } = ctx;

  useEffect(() => {
    if (!tallerId) return;
    void loadInventarioByTaller(tallerId);
  }, [loadInventarioByTaller, tallerId]);

  return {
    ...ctx,
    tallerId: tallerId || null,
  } as const;
}

