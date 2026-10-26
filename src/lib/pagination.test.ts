import { describe, expect, it } from "vitest";
import {
  buildPaginationMeta,
  calculatePaginationRange,
  getLimitSentinel,
  normalizePage,
  normalizePageSize,
  normalizePagination,
  normalizePaginationLimit,
  sliceWithHasMore,
} from "@/lib/pagination";

describe("pagination helpers", () => {
  it("normalizePaginationLimit: cuando se recibe un valor invalido o vacio, usa la constante DEFAULT_PAGINATION_LIMIT para iniciar una paginacion estable", () => {
    expect(normalizePaginationLimit(undefined)).toBe(100);
    expect(normalizePaginationLimit(null)).toBe(100);
    expect(normalizePaginationLimit("")).toBe(100);
    expect(normalizePaginationLimit("abc")).toBe(100);
  });

  it("normalizePaginationLimit: aplica minimo para evitar limites no validos pero conserva valores altos sin cap superior", () => {
    expect(normalizePaginationLimit(-20)).toBe(1);
    expect(normalizePaginationLimit(5000)).toBe(5000);
  });

  it("getLimitSentinel: agrega una fila extra para saber si existen mas resultados sin consultar el total", () => {
    expect(getLimitSentinel(100)).toBe(101);
    expect(getLimitSentinel(1)).toBe(2);
  });

  it("sliceWithHasMore: cuando llegan mas filas que el limite, recorta la lista y marca hasMore en true para infinite scroll", () => {
    const rows = ["a", "b", "c"];
    const result = sliceWithHasMore(rows, 2);

    expect(result.items).toEqual(["a", "b"]);
    expect(result.hasMore).toBe(true);
  });

  it("sliceWithHasMore: cuando las filas no superan el limite, devuelve todo y marca hasMore en false", () => {
    const rows = ["a", "b"];
    const result = sliceWithHasMore(rows, 2);

    expect(result.items).toEqual(["a", "b"]);
    expect(result.hasMore).toBe(false);
  });

  describe("normalizePage", () => {
    it("devuelve 1 para valores vacíos, no numéricos o menores o iguales a 0", () => {
      expect(normalizePage(undefined)).toBe(1);
      expect(normalizePage(null)).toBe(1);
      expect(normalizePage("")).toBe(1);
      expect(normalizePage(0)).toBe(1);
      expect(normalizePage(-5)).toBe(1);
      expect(normalizePage("not-a-number")).toBe(1);
    });

    it("trunca números decimales válidos y respeta enteros positivos", () => {
      expect(normalizePage(3.7)).toBe(3);
      expect(normalizePage("4")).toBe(4);
      expect(normalizePage(10)).toBe(10);
    });
  });

  describe("normalizePageSize", () => {
    it("devuelve el tamaño por defecto cuando el valor es inválido o menor al mínimo", () => {
      expect(normalizePageSize(undefined, 50)).toBe(50);
      expect(normalizePageSize("invalid", 25)).toBe(25);
      expect(normalizePageSize(0, 50, 100, 1)).toBe(50);
      expect(normalizePageSize(-10, 50)).toBe(50);
    });

    it("respeta el tamaño si está en rango y lo acota al máximo configurado", () => {
      expect(normalizePageSize(30, 50, 100)).toBe(30);
      expect(normalizePageSize(250, 50, 100)).toBe(100);
      expect(normalizePageSize("40", 50, 100)).toBe(40);
    });
  });

  describe("normalizePagination", () => {
    it("normaliza input completo con defaults seguros", () => {
      expect(normalizePagination()).toEqual({ page: 1, pageSize: 50 });
      expect(normalizePagination({ page: "2", pageSize: "20" })).toEqual({ page: 2, pageSize: 20 });
      expect(normalizePagination({ page: -1, pageSize: 500 }, { defaultPageSize: 25, maxPageSize: 100 })).toEqual({
        page: 1,
        pageSize: 100,
      });
    });
  });

  describe("calculatePaginationRange", () => {
    it("calcula offset, from y to correctamente para consultas con range de Supabase", () => {
      expect(calculatePaginationRange(1, 50)).toEqual({ offset: 0, from: 0, to: 49 });
      expect(calculatePaginationRange(2, 50)).toEqual({ offset: 50, from: 50, to: 99 });
      expect(calculatePaginationRange(3, 20)).toEqual({ offset: 40, from: 40, to: 59 });
    });
  });

  describe("buildPaginationMeta", () => {
    it("calcula totalPages y preserva datos de paginación", () => {
      expect(buildPaginationMeta(1, 50, 120)).toEqual({
        page: 1,
        pageSize: 50,
        total: 120,
        totalPages: 3,
      });
      expect(buildPaginationMeta(1, 50, 0)).toEqual({
        page: 1,
        pageSize: 50,
        total: 0,
        totalPages: 0,
      });
    });
  });
});

