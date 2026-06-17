"use client";

import { useMemo, useState } from "react";
import type { Producto } from "@/app/providers/ProductosProvider";
import { getStockStatus, type StockStatus } from "@/lib/stock";

export type ProductosFilters = {
  categorias: string[];
  tallerId: string;
  estado: StockStatus | "";
  visibilidad: "inventario" | "esporadico" | "todos";
};

export type ProductosChipKind =
  | { type: "categoria"; value: string }
  | { type: "taller" }
  | { type: "estado" }
  | { type: "visibilidad" };
export type ProductosChip = { key: string; text: string; kind: ProductosChipKind };

function createEmptyFilters(): ProductosFilters {
  return { categorias: [], tallerId: "", estado: "", visibilidad: "inventario" };
}

function matchesSearch(p: Producto, query: string) {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    p.nombre.toLowerCase().includes(q) ||
    p.codigo.toLowerCase().includes(q) ||
    p.proveedor.toLowerCase().includes(q) ||
    p.ubicacion.toLowerCase().includes(q)
  );
}

function matchesCategorias(p: Producto, categorias: string[]) {
  if (!categorias || categorias.length === 0) return true;
  return p.categorias.some((c) => categorias.includes(c));
}

function getRelevantStocks(p: Producto, tallerId: string) {
  const stocks = p.stocks ?? [];
  if (!tallerId) return stocks;
  return stocks.filter((s) => s.tallerId === tallerId);
}

function statusRank(status: StockStatus) {
  if (status === "critico") return 0;
  if (status === "bajo") return 1;
  if (status === "alto") return 2;
  return 3;
}

export function getProductoStockSummary(p: Producto, tallerId = "") {
  const stocks = getRelevantStocks(p, tallerId);
  const stockTotal = stocks.reduce((acc, s) => acc + (Number(s.stockActual) || 0), 0);
  const statuses = stocks.map((s) => getStockStatus(s));
  const worstStatus = statuses.sort((a, b) => statusRank(a) - statusRank(b))[0] ?? null;
  return {
    stockTotal,
    talleresConStock: stocks.length,
    worstStatus,
  };
}

function matchesTaller(p: Producto, tallerId: string) {
  if (!tallerId) return true;
  return (p.stocks ?? []).some((s) => s.tallerId === tallerId);
}

function matchesEstado(p: Producto, tallerId: string, estado: StockStatus | "") {
  if (!estado) return true;
  const stocks = getRelevantStocks(p, tallerId);
  return stocks.some((s) => getStockStatus(s) === estado);
}

function matchesVisibilidad(p: Producto, visibilidad: ProductosFilters["visibilidad"]) {
  if (visibilidad === "todos") return true;
  if (visibilidad === "esporadico") return !p.showInStock;
  return p.showInStock;
}

export function filterProductos(
  productos: Producto[] | undefined,
  params: { search: string; filters: ProductosFilters }
) {
  if (!productos) return [];
  return productos.filter(
    (p) =>
      matchesVisibilidad(p, params.filters.visibilidad) &&
      matchesTaller(p, params.filters.tallerId) &&
      matchesEstado(p, params.filters.tallerId, params.filters.estado) &&
      matchesSearch(p, params.search) &&
      matchesCategorias(p, params.filters.categorias)
  );
}

export function useProductosFilters(productos?: Producto[]) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ProductosFilters>(createEmptyFilters);

  const productosFiltrados = useMemo(() => {
    return filterProductos(productos, { search, filters });
  }, [productos, search, filters]);

  const chips = useMemo<ProductosChip[]>(() => {
    const result: ProductosChip[] = [];
    if (filters.tallerId) {
      result.push({ key: "taller", text: "Taller seleccionado", kind: { type: "taller" } });
    }
    if (filters.visibilidad !== "inventario") {
      result.push({
        key: "visibilidad",
        text: filters.visibilidad === "todos" ? "Mostrar todos" : "Stock esporadico",
        kind: { type: "visibilidad" },
      });
    }
    if (filters.estado) {
      result.push({
        key: "estado",
        text:
          filters.estado === "critico"
            ? "Sin stock"
            : filters.estado === "bajo"
              ? "Stock bajo"
              : filters.estado === "alto"
                ? "Exceso stock"
                : "Stock normal",
        kind: { type: "estado" },
      });
    }
    result.push(...(filters.categorias ?? []).map((cat) => ({
      key: `cat:${cat}`,
      text: cat,
      kind: { type: "categoria" as const, value: cat },
    })));
    return result;
  }, [filters]);

  const removeFilter = (kind: ProductosChipKind) => {
    setFilters((prev) => ({
      ...prev,
      ...(kind.type === "categoria" ? { categorias: prev.categorias.filter((c) => c !== kind.value) } : {}),
      ...(kind.type === "taller" ? { tallerId: "" } : {}),
      ...(kind.type === "estado" ? { estado: "" } : {}),
      ...(kind.type === "visibilidad" ? { visibilidad: "inventario" as const } : {}),
    }));
  };

  const clearFilters = () => setFilters(createEmptyFilters());
  const applyFilters = (next: ProductosFilters) => setFilters(next);

  return {
    search,
    setSearch,
    filters,
    chips,
    productosFiltrados,
    applyFilters,
    clearFilters,
    removeFilter,
  };
}

