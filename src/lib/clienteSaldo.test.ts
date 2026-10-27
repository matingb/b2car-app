import { describe, it, expect } from "vitest";
import { resolveClienteSaldo } from "./clienteSaldo";

describe("resolveClienteSaldo", () => {
  it("resuelve saldo deudor (> 0) correctamente", () => {
    const res = resolveClienteSaldo(140000);
    expect(res).toEqual({
      saldoNeto: 140000,
      saldoVisible: 140000,
      tieneDeuda: true,
      tieneSaldoAFavor: false,
      estaAlDia: false,
      formattedMonto: "$140.000",
    });
  });

  it("resuelve saldo a favor (< 0) correctamente", () => {
    const res = resolveClienteSaldo(-45000);
    expect(res).toEqual({
      saldoNeto: -45000,
      saldoVisible: 45000,
      tieneDeuda: false,
      tieneSaldoAFavor: true,
      estaAlDia: false,
      formattedMonto: "$45.000",
    });
  });

  it("resuelve saldo al día (= 0) correctamente", () => {
    const res = resolveClienteSaldo(0);
    expect(res).toEqual({
      saldoNeto: 0,
      saldoVisible: 0,
      tieneDeuda: false,
      tieneSaldoAFavor: false,
      estaAlDia: true,
      formattedMonto: "$0",
    });
  });

  it("trata null y undefined como al día ($0)", () => {
    expect(resolveClienteSaldo(null).estaAlDia).toBe(true);
    expect(resolveClienteSaldo(null).formattedMonto).toBe("$0");

    expect(resolveClienteSaldo(undefined).estaAlDia).toBe(true);
    expect(resolveClienteSaldo(undefined).formattedMonto).toBe("$0");
  });
});
