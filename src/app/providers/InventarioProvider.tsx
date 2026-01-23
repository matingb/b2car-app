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

function buildNextId(prefix: string, prev: { id: string }[]) {
  const max = prev
    .map((i) => Number(String(i.id).replace(`${prefix}-`, "")))
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 0);
  const next = max + 1;
  return `${prefix}-${String(next).padStart(3, "0")}`;
}

const PRODUCTOS_MOCK: Producto[] = [
  {
    productoId: "PROD-001",
    nombre: "Aceite Motor 10W40 Sintético",
    codigo: "ACE-10W40-SIN",
    categorias: ["Aceites y Lubricantes"],
    precioCompra: 8500,
    precioVenta: 12000,
    proveedor: "Lubricantes del Sur",
    ubicacion: "Estante A-1",
  },
  {
    productoId: "PROD-002",
    nombre: "Filtro de Aceite Universal",
    codigo: "FIL-ACE-UNI",
    categorias: ["Filtros", "Motor"],
    precioCompra: 2500,
    precioVenta: 4500,
    proveedor: "Filtros Premium SA",
    ubicacion: "Estante B-2",
  },
  {
    productoId: "PROD-003",
    nombre: "Pastillas de Freno Delanteras",
    codigo: "FRE-PAST-DEL",
    categorias: ["Frenos"],
    precioCompra: 15000,
    precioVenta: 25000,
    proveedor: "Frenos Seguros",
    ubicacion: "Estante C-1",
  },
  {
    productoId: "PROD-004",
    nombre: "Bujías NGK Platinum",
    codigo: "MOT-BUJ-NGK",
    categorias: ["Motor", "Eléctrico"],
    precioCompra: 3500,
    precioVenta: 6000,
    proveedor: "NGK Distribuidora",
    ubicacion: "Estante A-3",
  },
  {
    productoId: "PROD-005",
    nombre: "Neumático 205/55 R16",
    codigo: "NEU-205-55",
    categorias: ["Neumáticos"],
    precioCompra: 95000,
    precioVenta: 140000,
    proveedor: "Neumáticos Express",
    ubicacion: "Depósito 3",
  },
];

export function InventarioProvider({ children }: { children: React.ReactNode }) {
  const { talleres } = useTenant();
  const [loading, setLoading] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [stockRegistros, setStockRegistros] = useState<StockRegistro[]>([]);

  useEffect(() => {
    // Mock init: productos globales del tenant + stock por taller
    const now = formatShortEsDate(new Date());
    setProductos(PRODUCTOS_MOCK);

    const base: StockRegistro[] = [];
    for (const t of talleres) {
      for (const p of PRODUCTOS_MOCK) {
        // No todos los productos están en todos los talleres
        const include = (Number(p.productoId.replace("PROD-", "")) + Number(t.id.replace("TAL-", ""))) % 2 === 0;
        if (!include) continue;

        const id = `${t.id}-${p.productoId}`;
        const stockMaximo = 50;
        const stockMinimo = 10;
        const stockActual = Math.max(0, Math.min(stockMaximo, 5 + ((p.productoId.charCodeAt(7) + t.id.charCodeAt(6)) % 55)));
        base.push({
          id,
          productoId: p.productoId,
          tallerId: t.id,
          stockActual,
          stockMinimo,
          stockMaximo,
          ultimaActualizacion: now,
          historialMovimientos: [],
        });
      }
    }
    setStockRegistros(base);
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
        const productoId = input.productoId?.trim() || buildNextId("PROD", productos.map((p) => ({ id: p.productoId })));
        const nuevo: Producto = {
          productoId,
          nombre: input.nombre.trim(),
          codigo: input.codigo.trim(),
          categorias: input.categorias ?? [],
          precioCompra: input.precioCompra ?? 0,
          precioVenta: input.precioVenta ?? 0,
          proveedor: input.proveedor ?? "",
          ubicacion: input.ubicacion ?? "",
        };
        setProductos((prev) => [...prev, nuevo]);
        return nuevo;
      } finally {
        setLoading(false);
      }
    },
    [productos]
  );

  const updateProducto = useCallback(
    async (productoId: string, input: UpdateProductoInput) => {
      setLoading(true);
      try {
        let updated: Producto | null = null;
        setProductos((prev) =>
          prev.map((p) => {
            if (p.productoId !== productoId) return p;
            updated = { ...p, ...input };
            return updated;
          })
        );
        return updated;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const removeProducto = useCallback(async (productoId: string) => {
    setLoading(true);
    try {
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
        const now = formatShortEsDate(new Date());
        const existing = stockRegistros.find(
          (s) => s.productoId === input.productoId && s.tallerId === input.tallerId
        );

        if (existing) {
          const patch: Partial<StockRegistro> = {
            stockActual: input.stockActual ?? existing.stockActual,
            stockMinimo: input.stockMinimo ?? existing.stockMinimo,
            stockMaximo: input.stockMaximo ?? existing.stockMaximo,
            ultimaActualizacion: now,
          };
          let updated: StockRegistro | null = null;
          setStockRegistros((prev) =>
            prev.map((s) => {
              if (s.id !== existing.id) return s;
              updated = { ...s, ...patch };
              return updated;
            })
          );
          return updated;
        }

        const nuevo: StockRegistro = {
          id: `${input.tallerId}-${input.productoId}`,
          productoId: input.productoId,
          tallerId: input.tallerId,
          stockActual: input.stockActual ?? 0,
          stockMinimo: input.stockMinimo ?? 0,
          stockMaximo: input.stockMaximo ?? 0,
          ultimaActualizacion: now,
          historialMovimientos:
            input.stockActual && input.stockActual > 0
              ? [
                {
                  fecha: now,
                  tipo: "entrada",
                  cantidad: input.stockActual,
                  motivo: "Stock inicial",
                },
              ]
              : [],
        };
        setStockRegistros((prev) => [...prev, nuevo]);
        return nuevo;
      } finally {
        setLoading(false);
      }
    },
    [stockRegistros]
  );

  const updateStock = useCallback(async (id: string, patch: Partial<Omit<StockRegistro, "id" | "productoId" | "tallerId">>) => {
    setLoading(true);
    try {
      const now = formatShortEsDate(new Date());
      let updated: StockRegistro | null = null;
      setStockRegistros((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          updated = { ...s, ...patch, ultimaActualizacion: now };
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

