import { describe, expect, it } from "vitest";
import { calcLineTotal } from "./calcLineTotal";

describe("calcLineTotal", () => {
  it("calcula horas facturadas × cantidad × precio_hora", () => {
    expect(
      calcLineTotal({
        cantidad: 1,
        precio_hora_facturada: 15000,
      })
    ).toBe(15000);

    expect(
      calcLineTotal({
        cantidad: 2,
        horas_facturadas: 1,
        precio_hora_facturada: 10000,
      })
    ).toBe(20000);
  });

  it("calcula correctamente con horas decimales", () => {
    expect(
      calcLineTotal({
        cantidad: 1,
        horas_facturadas: 1.5,
        precio_hora_facturada: 20000,
      })
    ).toBe(30000);

    expect(
      calcLineTotal({
        cantidad: 2,
        horas_facturadas: 0.75,
        precio_hora_facturada: 10000,
      })
    ).toBe(15000);
  });

  it("multiplica por cantidad y devuelve 0 si precio es 0", () => {
    expect(
      calcLineTotal({
        cantidad: 0,
        horas_facturadas: 2,
        precio_hora_facturada: 15000,
      })
    ).toBe(0);

    expect(
      calcLineTotal({
        cantidad: 3,
        horas_facturadas: 1.5,
        precio_hora_facturada: 0,
      })
    ).toBe(0);
  });

  it("soporta valores pasados como string numérico", () => {
    expect(
      calcLineTotal({
        cantidad: "2",
        horas_facturadas: "2.5",
        precio_hora_facturada: "10000",
      })
    ).toBe(50000);
  });

  it("conserva el total histórico por cantidad cuando las horas son desconocidas", () => {
    expect(
      calcLineTotal({
        cantidad: 2,
        horas_facturadas: null,
        precio_hora_facturada: 5000,
      })
    ).toBe(10000);
  });

  it("trata cero como horas explícitas", () => {
    expect(calcLineTotal({ cantidad: 5, horas_facturadas: 0, precio_hora_facturada: 5000 })).toBe(0);
  });
});
