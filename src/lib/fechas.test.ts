import { describe, it, expect } from "vitest";
import { formatTimeAgo, isValidDate } from "./fechas";

describe("isValidDate", () => {
  it("debería retornar true para una fecha válida en formato YYYY-MM-DD", () => {
    expect(isValidDate("2025-11-29")).toBe(true);
  });

  it("debería retornar false para una cadena vacía", () => {
    expect(isValidDate("")).toBe(false);
  });

  it("debería retornar false para una fecha con día inválido", () => {
    expect(isValidDate("2025-02-30")).toBe(false);
  });

  it("debería retornar false para un formato incorrecto", () => {
    expect(isValidDate("29-11-2025")).toBe(false);
  });

  it("debería retornar false para texto que no es fecha", () => {
    expect(isValidDate("abc")).toBe(false);
  });
});

describe("formatTimeAgo", () => {
  const now = new Date("2026-01-03T12:00:00.000Z");

  it('si fecha es inválida, devuelve vacio', () => {
    expect(formatTimeAgo("no-es-fecha", now)).toBe("");
  });

  it("para segundos (<60), devuelve 'Hace ... segundos'", () => {
    const fecha = new Date(now.getTime() - 30 * 1000);
    expect(formatTimeAgo(fecha, now)).toBe("Hace 30 segundos");
  });

  it("para minutos (<60), devuelve 'Hace ... minutos'", () => {
    const fecha = new Date(now.getTime() - 15 * 60 * 1000);
    expect(formatTimeAgo(fecha, now)).toBe("Hace 15 minutos");
  });

  it("para horas (<24), devuelve 'Hace ... horas'", () => {
    const fecha = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    expect(formatTimeAgo(fecha, now)).toBe("Hace 2 horas");
  });

  it("para días (<30), devuelve 'Hace ... días'", () => {
    const fecha = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(fecha, now)).toBe("Hace 3 días");
  });

  it("para meses (<12), devuelve 'Hace ... meses'", () => {
    const fecha = new Date(now.getTime() - 2 * 30 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(fecha, now)).toBe("Hace 2 meses");
  });

  it("para años (>=12 meses), devuelve 'Hace ... años'", () => {
    const fecha = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(fecha, now)).toBe("Hace 2 años");
  });
});


