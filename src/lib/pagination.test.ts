import { describe, expect, it } from "vitest";
import {
  getLimitSentinel,
  normalizePaginationLimit,
  sliceWithHasMore,
} from "@/lib/pagination";

describe("pagination helpers", () => {
  it("normalizePaginationLimit: cuando se recibe un valor invalido, usa la constante DEFAULT_PAGINATION_LIMIT para iniciar una paginacion estable", () => {
    expect(normalizePaginationLimit(undefined)).toBe(100);
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
});
