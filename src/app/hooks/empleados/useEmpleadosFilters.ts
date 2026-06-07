"use client";

import { useMemo, useState } from "react";
import type { Empleado } from "@/app/providers/EmpleadosProvider";

export type EmpleadosFilters = {
  tallerId: string;
  salarioMin: number | null;
  salarioMax: number | null;
  cumpleanosDesde: string;
  cumpleanosHasta: string;
};

export type EmpleadosChipKind =
  | { type: "taller"; value: string }
  | { type: "salarioMin"; value: number }
  | { type: "salarioMax"; value: number }
  | { type: "cumpleanosDesde"; value: string }
  | { type: "cumpleanosHasta"; value: string };

export type EmpleadosChip = { key: string; text: string; kind: EmpleadosChipKind };

function createEmptyFilters(): EmpleadosFilters {
  return {
    tallerId: "",
    salarioMin: null,
    salarioMax: null,
    cumpleanosDesde: "",
    cumpleanosHasta: "",
  };
}

function matchesSearch(e: Empleado, query: string) {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const fullName = `${e.nombre} ${e.apellido}`.toLowerCase();
  return (
    fullName.includes(q) ||
    e.dni.toLowerCase().includes(q) ||
    e.email.toLowerCase().includes(q)
  );
}

function matchesTaller(e: Empleado, tallerId: string) {
  if (!tallerId) return true;
  return e.tallerId === tallerId;
}

function matchesSalario(e: Empleado, min: number | null, max: number | null) {
  if (min !== null && (e.salario ?? 0) < min) return false;
  if (max !== null && (e.salario ?? Number.POSITIVE_INFINITY) > max) return false;
  return true;
}

function matchesCumpleanos(e: Empleado, desde: string, hasta: string) {
  if (!desde && !hasta) return true;
  if (!e.cumpleanos) return false;
  if (desde && e.cumpleanos < desde) return false;
  if (hasta && e.cumpleanos > hasta) return false;
  return true;
}

export function filterEmpleados(
  empleados: Empleado[] | undefined,
  params: { search: string; filters: EmpleadosFilters }
) {
  if (!empleados) return [];
  const { search, filters } = params;
  return empleados.filter(
    (e) =>
      matchesSearch(e, search) &&
      matchesTaller(e, filters.tallerId) &&
      matchesSalario(e, filters.salarioMin, filters.salarioMax) &&
      matchesCumpleanos(e, filters.cumpleanosDesde, filters.cumpleanosHasta)
  );
}

function formatSalarioLabel(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function useEmpleadosFilters(
  empleados: Empleado[] | undefined,
  resolveTallerNombre?: (id: string) => string | undefined
) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<EmpleadosFilters>(createEmptyFilters);

  const empleadosFiltrados = useMemo(() => {
    return filterEmpleados(empleados, { search, filters });
  }, [empleados, search, filters]);

  const chips = useMemo<EmpleadosChip[]>(() => {
    const list: EmpleadosChip[] = [];
    if (filters.tallerId) {
      const nombre = resolveTallerNombre?.(filters.tallerId) ?? filters.tallerId;
      list.push({
        key: `taller:${filters.tallerId}`,
        text: `Taller: ${nombre}`,
        kind: { type: "taller", value: filters.tallerId },
      });
    }
    if (filters.salarioMin !== null) {
      list.push({
        key: `salarioMin:${filters.salarioMin}`,
        text: `Salario ≥ ${formatSalarioLabel(filters.salarioMin)}`,
        kind: { type: "salarioMin", value: filters.salarioMin },
      });
    }
    if (filters.salarioMax !== null) {
      list.push({
        key: `salarioMax:${filters.salarioMax}`,
        text: `Salario ≤ ${formatSalarioLabel(filters.salarioMax)}`,
        kind: { type: "salarioMax", value: filters.salarioMax },
      });
    }
    if (filters.cumpleanosDesde) {
      list.push({
        key: `cumpleanosDesde:${filters.cumpleanosDesde}`,
        text: `Nacimiento desde ${filters.cumpleanosDesde}`,
        kind: { type: "cumpleanosDesde", value: filters.cumpleanosDesde },
      });
    }
    if (filters.cumpleanosHasta) {
      list.push({
        key: `cumpleanosHasta:${filters.cumpleanosHasta}`,
        text: `Nacimiento hasta ${filters.cumpleanosHasta}`,
        kind: { type: "cumpleanosHasta", value: filters.cumpleanosHasta },
      });
    }
    return list;
  }, [filters, resolveTallerNombre]);

  const removeFilter = (kind: EmpleadosChipKind) => {
    setFilters((prev) => {
      switch (kind.type) {
        case "taller":
          return { ...prev, tallerId: "" };
        case "salarioMin":
          return { ...prev, salarioMin: null };
        case "salarioMax":
          return { ...prev, salarioMax: null };
        case "cumpleanosDesde":
          return { ...prev, cumpleanosDesde: "" };
        case "cumpleanosHasta":
          return { ...prev, cumpleanosHasta: "" };
        default:
          return prev;
      }
    });
  };

  const clearFilters = () => setFilters(createEmptyFilters());
  const applyFilters = (next: EmpleadosFilters) => setFilters(next);

  return {
    search,
    setSearch,
    filters,
    chips,
    empleadosFiltrados,
    applyFilters,
    clearFilters,
    removeFilter,
  };
}
