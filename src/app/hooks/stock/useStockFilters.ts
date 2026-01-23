"use client";

import { useMemo, useState } from "react";
import type { StockItem } from "@/model/stock";
import { getStockStatus, type StockStatus } from "@/lib/stock";

export type StockFilters = {
  categorias: string[];
  estado: StockStatus | "";
};

export type StockChipKind =
  | { type: "estado" }
  | { type: "categoria"; value: string };

export type StockChip = { key: string; text: string; kind: StockChipKind };

function createEmptyFilters(): StockFilters {
  return { categorias: [], estado: "" };
}

function matchesSearch(item: StockItem, query: string) {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    item.nombre.toLowerCase().includes(q) ||
    item.codigo.toLowerCase().includes(q) ||
    item.proveedor.toLowerCase().includes(q) ||
    item.ubicacion.toLowerCase().includes(q)
  );
}

function matchesCategorias(item: StockItem, categorias: string[]) {
  if (!categorias || categorias.length === 0) return true;
  return item.categorias.some((c) => categorias.includes(c));
}

function matchesEstado(item: StockItem, estado: StockFilters["estado"]) {
  if (!estado) return true;
  return getStockStatus(item) === estado;
}

export function filterStockItems(
  items: StockItem[] | undefined,
  params: { search: string; filters: StockFilters }
) {
  if (!items) return [];
  return items.filter(
    (i) =>
      matchesSearch(i, params.search) &&
      matchesCategorias(i, params.filters.categorias) &&
      matchesEstado(i, params.filters.estado)
  );
}

export function useStockFilters(items?: StockItem[]) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<StockFilters>(createEmptyFilters);

  const itemsFiltrados = useMemo(() => {
    return filterStockItems(items, { search, filters });
  }, [items, search, filters]);

  const chips = useMemo<StockChip[]>(() => {
    const result: StockChip[] = [];
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
    for (const cat of filters.categorias) {
      result.push({
        key: `cat:${cat}`,
        text: cat,
        kind: { type: "categoria", value: cat },
      });
    }
    return result;
  }, [filters.estado, filters.categorias]);

  const removeFilter = (kind: StockChipKind) => {
    setFilters((prev) => {
      if (kind.type === "estado") return { ...prev, estado: "" };
      return { ...prev, categorias: prev.categorias.filter((c) => c !== kind.value) };
    });
  };

  const clearFilters = () => setFilters(createEmptyFilters());
  const applyFilters = (next: StockFilters) => setFilters(next);

  return {
    search,
    setSearch,
    filters,
    chips,
    itemsFiltrados,
    applyFilters,
    clearFilters,
    removeFilter,
  };
}

export function useStockStats(items?: StockItem[]) {
  return useMemo(() => {
    const list = items ?? [];
    const criticos = list.filter((i) => getStockStatus(i) === "critico").length;
    const bajos = list.filter((i) => getStockStatus(i) === "bajo").length;
    const altos = list.filter((i) => getStockStatus(i) === "alto").length;
    const normales = list.filter((i) => getStockStatus(i) === "normal").length;
    return { criticos, bajos, altos, normales, total: list.length };
  }, [items]);
}

