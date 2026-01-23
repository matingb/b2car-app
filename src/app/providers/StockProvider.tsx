"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { StockItem } from "@/model/stock";

export const STOCK_CATEGORIAS_DISPONIBLES = [
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

export type CreateStockItemInput = Omit<
  StockItem,
  "id" | "ultimaActualizacion" | "historialMovimientos"
> & {
  id?: string;
  ultimaActualizacion?: string;
  historialMovimientos?: StockItem["historialMovimientos"];
};

export type UpdateStockItemInput = Partial<Omit<StockItem, "id">>;

type StockContextType = {
  items: StockItem[];
  loading: boolean;
  categoriasDisponibles: readonly string[];
  fetchAll: () => Promise<StockItem[] | null>;
  fetchById: (id: string) => Promise<StockItem | null>;
  create: (input: CreateStockItemInput) => Promise<StockItem | null>;
  update: (id: string, input: UpdateStockItemInput) => Promise<StockItem | null>;
  remove: (id: string) => Promise<void>;
};

const StockContext = createContext<StockContextType | null>(null);

function formatShortEsDate(d: Date) {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear());
  return `${day}/${month}/${year}`;
}

function buildNextStockId(prev: StockItem[]) {
  const max = prev
    .map((i) => Number(i.id.replace("STK-", "")))
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 0);
  const next = max + 1;
  return `STK-${String(next).padStart(3, "0")}`;
}

const stockItemsMock: StockItem[] = [
  {
    id: "STK-001",
    nombre: "Aceite Motor 10W40 Sintético",
    codigo: "ACE-10W40-SIN",
    categorias: ["Aceites y Lubricantes"],
    stockActual: 45,
    stockMinimo: 20,
    stockMaximo: 100,
    precioCompra: 8500,
    precioVenta: 12000,
    proveedor: "Lubricantes del Sur",
    ubicacion: "Estante A-1",
    ultimaActualizacion: "12/01/2026",
    historialMovimientos: [
      { fecha: "12/01/2026", tipo: "entrada", cantidad: 20, motivo: "Compra proveedor" },
      { fecha: "10/01/2026", tipo: "salida", cantidad: 5, motivo: "Arreglo ARR-0501" },
      { fecha: "08/01/2026", tipo: "salida", cantidad: 3, motivo: "Arreglo ARR-0498" },
    ],
  },
  {
    id: "STK-002",
    nombre: "Filtro de Aceite Universal",
    codigo: "FIL-ACE-UNI",
    categorias: ["Filtros", "Motor"],
    stockActual: 8,
    stockMinimo: 15,
    stockMaximo: 50,
    precioCompra: 2500,
    precioVenta: 4500,
    proveedor: "Filtros Premium SA",
    ubicacion: "Estante B-2",
    ultimaActualizacion: "11/01/2026",
    historialMovimientos: [
      { fecha: "11/01/2026", tipo: "salida", cantidad: 4, motivo: "Arreglo ARR-0500" },
      { fecha: "09/01/2026", tipo: "salida", cantidad: 3, motivo: "Arreglo ARR-0497" },
    ],
  },
  {
    id: "STK-003",
    nombre: "Pastillas de Freno Delanteras",
    codigo: "FRE-PAST-DEL",
    categorias: ["Frenos"],
    stockActual: 32,
    stockMinimo: 10,
    stockMaximo: 40,
    precioCompra: 15000,
    precioVenta: 25000,
    proveedor: "Frenos Seguros",
    ubicacion: "Estante C-1",
    ultimaActualizacion: "10/01/2026",
    historialMovimientos: [
      { fecha: "10/01/2026", tipo: "entrada", cantidad: 20, motivo: "Compra proveedor" },
      { fecha: "07/01/2026", tipo: "salida", cantidad: 2, motivo: "Arreglo ARR-0495" },
    ],
  },
  {
    id: "STK-004",
    nombre: "Amortiguador Trasero Monroe",
    codigo: "SUS-AMO-TRA",
    categorias: ["Suspensión"],
    stockActual: 55,
    stockMinimo: 8,
    stockMaximo: 30,
    precioCompra: 45000,
    precioVenta: 72000,
    proveedor: "Monroe Argentina",
    ubicacion: "Depósito 2",
    ultimaActualizacion: "09/01/2026",
    historialMovimientos: [
      { fecha: "09/01/2026", tipo: "entrada", cantidad: 40, motivo: "Compra mayorista" },
      { fecha: "05/01/2026", tipo: "salida", cantidad: 4, motivo: "Arreglo ARR-0490" },
    ],
  },
  {
    id: "STK-005",
    nombre: "Batería 12V 75Ah",
    codigo: "ELE-BAT-75",
    categorias: ["Eléctrico"],
    stockActual: 12,
    stockMinimo: 5,
    stockMaximo: 20,
    precioCompra: 85000,
    precioVenta: 120000,
    proveedor: "Baterías del Norte",
    ubicacion: "Depósito 1",
    ultimaActualizacion: "08/01/2026",
    historialMovimientos: [
      { fecha: "08/01/2026", tipo: "entrada", cantidad: 10, motivo: "Compra proveedor" },
      { fecha: "06/01/2026", tipo: "salida", cantidad: 2, motivo: "Arreglo ARR-0488" },
    ],
  },
  {
    id: "STK-006",
    nombre: "Bujías NGK Platinum",
    codigo: "MOT-BUJ-NGK",
    categorias: ["Motor", "Eléctrico"],
    stockActual: 3,
    stockMinimo: 20,
    stockMaximo: 80,
    precioCompra: 3500,
    precioVenta: 6000,
    proveedor: "NGK Distribuidora",
    ubicacion: "Estante A-3",
    ultimaActualizacion: "07/01/2026",
    historialMovimientos: [
      { fecha: "07/01/2026", tipo: "salida", cantidad: 8, motivo: "Arreglo ARR-0485" },
      { fecha: "05/01/2026", tipo: "salida", cantidad: 12, motivo: "Arreglo ARR-0482" },
    ],
  },
  {
    id: "STK-007",
    nombre: "Neumático 205/55 R16",
    codigo: "NEU-205-55",
    categorias: ["Neumáticos"],
    stockActual: 28,
    stockMinimo: 12,
    stockMaximo: 40,
    precioCompra: 95000,
    precioVenta: 140000,
    proveedor: "Neumáticos Express",
    ubicacion: "Depósito 3",
    ultimaActualizacion: "06/01/2026",
    historialMovimientos: [
      { fecha: "06/01/2026", tipo: "entrada", cantidad: 16, motivo: "Compra proveedor" },
      { fecha: "03/01/2026", tipo: "salida", cantidad: 4, motivo: "Arreglo ARR-0478" },
    ],
  },
  {
    id: "STK-008",
    nombre: "Correa de Distribución Gates",
    codigo: "MOT-COR-DIS",
    categorias: ["Motor"],
    stockActual: 6,
    stockMinimo: 8,
    stockMaximo: 25,
    precioCompra: 22000,
    precioVenta: 38000,
    proveedor: "Gates Argentina",
    ubicacion: "Estante B-4",
    ultimaActualizacion: "05/01/2026",
    historialMovimientos: [
      { fecha: "05/01/2026", tipo: "salida", cantidad: 2, motivo: "Arreglo ARR-0476" },
      { fecha: "02/01/2026", tipo: "salida", cantidad: 3, motivo: "Arreglo ARR-0470" },
    ],
  },
  {
    id: "STK-009",
    nombre: "Líquido Refrigerante Verde",
    codigo: "ACE-REF-VER",
    categorias: ["Aceites y Lubricantes", "Motor"],
    stockActual: 35,
    stockMinimo: 15,
    stockMaximo: 50,
    precioCompra: 4500,
    precioVenta: 7500,
    proveedor: "Lubricantes del Sur",
    ubicacion: "Estante A-2",
    ultimaActualizacion: "04/01/2026",
    historialMovimientos: [
      { fecha: "04/01/2026", tipo: "entrada", cantidad: 25, motivo: "Compra proveedor" },
      { fecha: "01/01/2026", tipo: "salida", cantidad: 5, motivo: "Arreglo ARR-0465" },
    ],
  },
  {
    id: "STK-010",
    nombre: "Kit Embrague Valeo",
    codigo: "MOT-EMB-VAL",
    categorias: ["Motor"],
    stockActual: 4,
    stockMinimo: 3,
    stockMaximo: 10,
    precioCompra: 125000,
    precioVenta: 180000,
    proveedor: "Valeo Distribuidora",
    ubicacion: "Depósito 1",
    ultimaActualizacion: "03/01/2026",
    historialMovimientos: [
      { fecha: "03/01/2026", tipo: "entrada", cantidad: 3, motivo: "Compra proveedor" },
      { fecha: "28/12/2025", tipo: "salida", cantidad: 1, motivo: "Arreglo ARR-0460" },
    ],
  },
  {
    id: "STK-011",
    nombre: "Disco de Freno Ventilado",
    codigo: "FRE-DIS-VEN",
    categorias: ["Frenos"],
    stockActual: 0,
    stockMinimo: 6,
    stockMaximo: 20,
    precioCompra: 28000,
    precioVenta: 45000,
    proveedor: "Frenos Seguros",
    ubicacion: "Estante C-2",
    ultimaActualizacion: "02/01/2026",
    historialMovimientos: [
      { fecha: "02/01/2026", tipo: "salida", cantidad: 2, motivo: "Arreglo ARR-0458" },
      { fecha: "30/12/2025", tipo: "salida", cantidad: 4, motivo: "Arreglo ARR-0455" },
    ],
  },
  {
    id: "STK-012",
    nombre: "Llave Combinada Set 10pcs",
    codigo: "HER-LLA-SET",
    categorias: ["Herramientas"],
    stockActual: 15,
    stockMinimo: 5,
    stockMaximo: 15,
    precioCompra: 35000,
    precioVenta: 55000,
    proveedor: "Herramientas Pro",
    ubicacion: "Estante D-1",
    ultimaActualizacion: "01/01/2026",
    historialMovimientos: [{ fecha: "01/01/2026", tipo: "entrada", cantidad: 10, motivo: "Reposición inventario" }],
  },
];

export function StockProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Mock: simula fuente de datos centralizada
      setItems(stockItemsMock);
      return stockItemsMock;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchById = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        const found = items.find((i) => i.id === id) ?? stockItemsMock.find((i) => i.id === id);
        return found ?? null;
      } finally {
        setLoading(false);
      }
    },
    [items]
  );

  const create = useCallback(async (input: CreateStockItemInput) => {
    setLoading(true);
    try {
      const now = new Date();
      const id = input.id?.trim() || buildNextStockId(items.length ? items : stockItemsMock);
      const nuevo: StockItem = {
        id,
        nombre: input.nombre,
        codigo: input.codigo,
        categorias: input.categorias ?? [],
        stockActual: input.stockActual ?? 0,
        stockMinimo: input.stockMinimo ?? 0,
        stockMaximo: input.stockMaximo ?? 0,
        precioCompra: input.precioCompra ?? 0,
        precioVenta: input.precioVenta ?? 0,
        proveedor: input.proveedor ?? "",
        ubicacion: input.ubicacion ?? "",
        ultimaActualizacion: input.ultimaActualizacion ?? formatShortEsDate(now),
        historialMovimientos:
          input.historialMovimientos ??
          (input.stockActual && input.stockActual > 0
            ? [
              {
                fecha: formatShortEsDate(now),
                tipo: "entrada",
                cantidad: input.stockActual,
                motivo: "Stock inicial",
              },
            ]
            : []),
      };
      setItems((prev) => [...prev, nuevo]);
      return nuevo;
    } finally {
      setLoading(false);
    }
  }, [items]);

  const update = useCallback(async (id: string, input: UpdateStockItemInput) => {
    setLoading(true);
    try {
      let updatedItem: StockItem | null = null;
      setItems((prev) => {
        const now = formatShortEsDate(new Date());
        return prev.map((i) => {
          if (i.id !== id) return i;
          updatedItem = {
            ...i,
            ...input,
            ultimaActualizacion: input.ultimaActualizacion ?? now,
          };
          return updatedItem;
        });
      });
      return updatedItem;
    } finally {
      setLoading(false);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setLoading(true);
    try {
      setItems((prev) => prev.filter((i) => i.id !== id));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const value = useMemo(
    () => ({
      items,
      loading,
      categoriasDisponibles: STOCK_CATEGORIAS_DISPONIBLES as readonly string[],
      fetchAll,
      fetchById,
      create,
      update,
      remove,
    }),
    [items, loading, fetchAll, fetchById, create, update, remove]
  );

  return <StockContext.Provider value={value}>{children}</StockContext.Provider>;
}

export function useStock() {
  const ctx = useContext(StockContext);
  if (!ctx) throw new Error("useStock debe usarse dentro de StockProvider");
  return ctx;
}

