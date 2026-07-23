"use client";

import { useMemo, useState } from "react";
import type { Producto } from "@/app/providers/ProductosProvider";
import { getStockStatus, type StockStatus } from "@/lib/stock";

export type ProductosFilters = {
  categorias: string[];
  estado: StockStatus | "";
  visibilidad: "inventario" | "esporadico" | "todos";
};

function createEmptyFilters(): ProductosFilters {
  return { categorias: [], estado: "", visibilidad: "inventario" };
}

function matchesSearch(producto: Producto, query: string) {
  if (!query) return true;
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return (
    producto.nombre.toLowerCase().includes(normalizedQuery) ||
    producto.codigo.toLowerCase().includes(normalizedQuery) ||
    producto.proveedor.toLowerCase().includes(normalizedQuery)
  );
}

function matchesCategorias(producto: Producto, categorias: string[]) {
  if (!categorias.length) return true;
  return producto.categorias.some((categoria) => categorias.includes(categoria));
}

function getRelevantStocks(producto: Producto, tallerId: string) {
  const stocks = producto.stocks ?? [];
  return tallerId ? stocks.filter((stock) => stock.tallerId === tallerId) : stocks;
}

function statusRank(status: StockStatus) {
  if (status === "critico") return 0;
  if (status === "bajo") return 1;
  if (status === "alto") return 2;
  return 3;
}

export function getProductoStockSummary(producto: Producto, tallerId = "") {
  const stocks = getRelevantStocks(producto, tallerId);
  const stockTotal = stocks.reduce((total, stock) => total + (Number(stock.stockActual) || 0), 0);
  const statuses = stocks.map((stock) => getStockStatus(stock));
  const worstStatus = statuses.sort((a, b) => statusRank(a) - statusRank(b))[0] ?? null;

  return {
    stockTotal,
    talleresConStock: stocks.length,
    worstStatus,
  };
}

function getProductoStockStatus(producto: Producto, tallerId: string): StockStatus {
  return getProductoStockSummary(producto, tallerId).worstStatus ?? "critico";
}

function matchesTaller(producto: Producto, tallerId: string) {
  return !tallerId || (producto.stocks ?? []).some((stock) => stock.tallerId === tallerId);
}

function matchesEstado(producto: Producto, tallerId: string, estado: StockStatus | "") {
  return !estado || getProductoStockStatus(producto, tallerId) === estado;
}

function matchesVisibilidad(producto: Producto, visibilidad: ProductosFilters["visibilidad"]) {
  if (visibilidad === "todos") return true;
  if (visibilidad === "esporadico") return !producto.showInStock;
  return producto.showInStock;
}

export function filterProductos(
  productos: Producto[] | undefined,
  params: { search: string; filters: ProductosFilters; tallerId?: string },
) {
  if (!productos) return [];
  const tallerId = params.tallerId ?? "";

  return productos.filter(
    (producto) =>
      matchesVisibilidad(producto, params.filters.visibilidad) &&
      matchesTaller(producto, tallerId) &&
      matchesEstado(producto, tallerId, params.filters.estado) &&
      matchesSearch(producto, params.search) &&
      matchesCategorias(producto, params.filters.categorias),
  );
}

export function useProductosFilters(productos?: Producto[], tallerId = "") {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ProductosFilters>(createEmptyFilters);

  const productosFiltrados = useMemo(
    () => filterProductos(productos, { search, filters, tallerId }),
    [productos, search, filters, tallerId],
  );

  const stats = useMemo(() => {
    const base = (productos ?? []).filter(
      (producto) =>
        matchesVisibilidad(producto, filters.visibilidad) &&
        matchesTaller(producto, tallerId) &&
        matchesSearch(producto, search) &&
        matchesCategorias(producto, filters.categorias),
    );
    const criticos = base.filter((producto) => getProductoStockStatus(producto, tallerId) === "critico").length;
    const bajos = base.filter((producto) => getProductoStockStatus(producto, tallerId) === "bajo").length;
    const altos = base.filter((producto) => getProductoStockStatus(producto, tallerId) === "alto").length;
    const normales = base.filter((producto) => getProductoStockStatus(producto, tallerId) === "normal").length;

    return { criticos, bajos, altos, normales, total: base.length };
  }, [productos, search, filters, tallerId]);

  const applyFilters = (next: ProductosFilters) => setFilters(next);

  return {
    search,
    setSearch,
    filters,
    productosFiltrados,
    stats,
    applyFilters,
  };
}
