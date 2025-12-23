"use client";

import type { Arreglo } from "@/model/types";
import { useMemo, useState } from "react";
import type { ArregloFilters } from "@/app/components/arreglos/ArregloFiltersModal";

export type ChipKind = "fechaRange" | "fechaDesde" | "fechaHasta" | "patente" | "tipo";
export type Chip = { key: string; text: string; kind: ChipKind };

type DateRange = { from: Date | null; to: Date | null };

function createEmptyFilters(): ArregloFilters {
  return {
    fechaDesde: "",
    fechaHasta: "",
    patente: "",
    tipo: "",
  };
}

function getDateRange(filters: ArregloFilters): DateRange {
  const hasDateFilter = filters.fechaDesde || filters.fechaHasta;
  if (!hasDateFilter) return { from: null, to: null };

  const from = filters.fechaDesde ? new Date(filters.fechaDesde) : null;
  const to = filters.fechaHasta ? new Date(filters.fechaHasta) : null;
  if (from) from.setHours(0, 0, 0, 0);
  if (to) to.setHours(23, 59, 59, 999);
  return { from, to };
}

function matchesSearch(arreglo: Arreglo, query: string) {
  if (!query) return true;
  const inFlat = Object.values(arreglo ?? {}).some((v) =>
    String(v ?? "").toLowerCase().includes(query)
  );
  const patente = String(arreglo?.vehiculo?.patente ?? "").toLowerCase();
  const inPatente = patente.includes(query);
  return inFlat || inPatente;
}

function matchesPatenteFilter(arreglo: Arreglo, patenteFilter: string) {
  if (!patenteFilter) return true;
  return String(arreglo?.vehiculo?.patente ?? "")
    .toLowerCase()
    .includes(patenteFilter);
}

function matchesTipoFilter(arreglo: Arreglo, tipoFilter: string) {
  if (!tipoFilter) return true;
  return String(arreglo?.tipo ?? "").toLowerCase().includes(tipoFilter);
}

function matchesDateRange(arreglo: Arreglo, range: DateRange) {
  if (!range.from && !range.to) return true;

  const fecha = new Date(arreglo.fecha);
  if (Number.isNaN(fecha.getTime())) return false;
  if (range.from && fecha < range.from) return false;
  if (range.to && fecha > range.to) return false;
  return true;
}

export function filterArreglos(
  arreglos: Arreglo[] | undefined,
  params: { search: string; filters: ArregloFilters }
) {
  if (!arreglos) return [];
  const query = params.search.trim().toLowerCase();
  const patenteFilter = params.filters.patente.trim().toLowerCase();
  const tipoFilter = params.filters.tipo.trim().toLowerCase();
  const dateRange = getDateRange(params.filters);

  return arreglos.filter(
    (a) =>
      matchesSearch(a, query) &&
      matchesPatenteFilter(a, patenteFilter) &&
      matchesTipoFilter(a, tipoFilter) &&
      matchesDateRange(a, dateRange)
  );
}

function formatDateLabel(dateString: string) {
  if (!dateString) return "";
  const normalized = dateString.replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) {
    const base = dateString.slice(0, 10);
    const [y, m, da] = base.split("-");
    if (y && m && da) return `${da}/${m}/${y}`;
    return base;
  }
  return new Intl.DateTimeFormat("es-ES", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(d);
}

export function useArreglosFilters(arreglos?: Arreglo[]) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ArregloFilters>(createEmptyFilters);

  const arreglosFiltrados = useMemo(() => {
    return filterArreglos(arreglos, { search, filters });
  }, [arreglos, search, filters]);

  const chips = useMemo<Chip[]>(() => {
    const items: Chip[] = [];

    if (filters.fechaDesde || filters.fechaHasta) {
      const desde = formatDateLabel(filters.fechaDesde);
      const hasta = formatDateLabel(filters.fechaHasta);
      if (filters.fechaDesde && filters.fechaHasta) {
        items.push({
          key: "fechaRange",
          text: `${desde} - ${hasta}`,
          kind: "fechaRange",
        });
      } else if (filters.fechaDesde) {
        items.push({
          key: "fechaDesde",
          text: `Desde: ${desde}`,
          kind: "fechaDesde",
        });
      } else if (filters.fechaHasta) {
        items.push({
          key: "fechaHasta",
          text: `Hasta: ${hasta}`,
          kind: "fechaHasta",
        });
      }
    }

    if (filters.patente.trim()) {
      items.push({
        key: "patente",
        text: filters.patente.trim(),
        kind: "patente",
      });
    }

    if (filters.tipo.trim()) {
      items.push({
        key: "tipo",
        text: filters.tipo.trim(),
        kind: "tipo",
      });
    }

    return items;
  }, [filters]);

  const removeFilter = (kind: ChipKind) => {
    setFilters((prev) => {
      switch (kind) {
        case "fechaRange":
          return { ...prev, fechaDesde: "", fechaHasta: "" };
        case "fechaDesde":
          return { ...prev, fechaDesde: "" };
        case "fechaHasta":
          return { ...prev, fechaHasta: "" };
        case "patente":
          return { ...prev, patente: "" };
        case "tipo":
          return { ...prev, tipo: "" };
        default:
          return prev;
      }
    });
  };

  const clearFilters = () => setFilters(createEmptyFilters());
  const applyFilters = (next: ArregloFilters) => setFilters(next);

  return {
    search,
    setSearch,
    filters,
    chips,
    arreglosFiltrados,
    applyFilters,
    clearFilters,
    removeFilter,
  };
}


