"use client";

import { useMemo, useState } from "react";
import type { Producto } from "@/app/providers/InventarioProvider";

export type ProductosFilters = {
  categorias: string[];
};

export type ProductosChipKind = { type: "categoria"; value: string };
export type ProductosChip = { key: string; text: string; kind: ProductosChipKind };

function createEmptyFilters(): ProductosFilters {
  return { categorias: [] };
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

export function filterProductos(
  productos: Producto[] | undefined,
  params: { search: string; filters: ProductosFilters }
) {
  if (!productos) return [];
  return productos.filter(
    (p) => matchesSearch(p, params.search) && matchesCategorias(p, params.filters.categorias)
  );
}

export function useProductosFilters(productos?: Producto[]) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ProductosFilters>(createEmptyFilters);

  const productosFiltrados = useMemo(() => {
    return filterProductos(productos, { search, filters });
  }, [productos, search, filters]);

  const chips = useMemo<ProductosChip[]>(() => {
    return (filters.categorias ?? []).map((cat) => ({
      key: `cat:${cat}`,
      text: cat,
      kind: { type: "categoria", value: cat },
    }));
  }, [filters.categorias]);

  const removeFilter = (kind: ProductosChipKind) => {
    setFilters((prev) => ({
      ...prev,
      categorias: prev.categorias.filter((c) => c !== kind.value),
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

