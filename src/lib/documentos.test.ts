import { describe, expect, it } from "vitest";
import { formatClienteDocumento, isValidDniCuil, normalizeDniCuil } from "./documentos";
import { TipoCliente } from "@/model/types";

describe("documentos de particulares", () => {
  it("normaliza separadores de DNI y CUIL", () => {
    expect(normalizeDniCuil("20-12345678-6")).toBe("20123456786");
    expect(normalizeDniCuil(" ")).toBeNull();
  });

  it("acepta DNI de 7/8 dígitos y CUIL de 11", () => {
    expect(isValidDniCuil("1234567")).toBe(true);
    expect(isValidDniCuil("12345678")).toBe(true);
    expect(isValidDniCuil("20123456786")).toBe(true);
    expect(isValidDniCuil("123456789")).toBe(false);
  });
});

describe("formatClienteDocumento", () => {
  it("formatea DNI para particulares", () => {
    expect(
      formatClienteDocumento({
        tipo_cliente: TipoCliente.PARTICULAR,
        dni_cuil: "35123456",
      })
    ).toBe("DNI: 35123456");

    expect(
      formatClienteDocumento({
        tipo_cliente: TipoCliente.PARTICULAR,
        dni_cuil: "DNI 35123456",
      })
    ).toBe("DNI 35123456");
  });

  it("formatea CUIT para empresas", () => {
    expect(
      formatClienteDocumento({
        tipo_cliente: TipoCliente.EMPRESA,
        cuit: "30-11111111-1",
      })
    ).toBe("CUIT: 30-11111111-1");

    expect(
      formatClienteDocumento({
        tipo_cliente: TipoCliente.EMPRESA,
        cuit: "CUIT 30-11111111-1",
      })
    ).toBe("CUIT 30-11111111-1");
  });

  it("devuelve undefined cuando no hay documento o cliente", () => {
    expect(formatClienteDocumento(null)).toBeUndefined();
    expect(formatClienteDocumento(undefined)).toBeUndefined();
    expect(
      formatClienteDocumento({
        tipo_cliente: TipoCliente.PARTICULAR,
        dni_cuil: null,
      })
    ).toBeUndefined();
    expect(
      formatClienteDocumento({
        tipo_cliente: TipoCliente.EMPRESA,
        cuit: "",
      })
    ).toBeUndefined();
  });
});
