import { describe, expect, it, vi } from "vitest";
import {
  checkArcaBillingConnection,
  FacturacionValidationError,
  isConfiguredSalesPoint,
} from "./facturacionService";

vi.mock("server-only", () => ({}));

describe("prueba de conexion WSFE", () => {
  it("consulta primero los tipos de comprobante y luego los puntos de venta", async () => {
    const calls: string[] = [];
    const gateway = {
      getVoucherTypes: vi.fn(async () => {
        calls.push("FEParamGetTiposCbte");
        return [{ Id: 11, Desc: "Factura C" }];
      }),
      getSalesPoints: vi.fn(async () => {
        calls.push("FEParamGetPtosVenta");
        return [{ Nro: 4 }];
      }),
    };

    await expect(checkArcaBillingConnection(gateway, 4)).resolves.toEqual({
      puntoVentaConfigurado: true,
    });
    expect(calls).toEqual(["FEParamGetTiposCbte", "FEParamGetPtosVenta"]);
  });

  it("devuelve advertencia funcional si el punto configurado no figura en ARCA", async () => {
    await expect(checkArcaBillingConnection({
      getVoucherTypes: vi.fn().mockResolvedValue([{ Id: 11 }]),
      getSalesPoints: vi.fn().mockResolvedValue([{ Nro: 2 }]),
    }, 4)).resolves.toEqual({ puntoVentaConfigurado: false });
  });

  it("interpreta el 602 de FEParamGetPtosVenta como ausencia de puntos de venta", async () => {
    await expect(checkArcaBillingConnection({
      getVoucherTypes: vi.fn().mockResolvedValue([{ Id: 11 }]),
      getSalesPoints: vi.fn().mockRejectedValue(
        new Error("(602) Sin Resultados: - Metodo FEParamGetPtosVenta"),
      ),
    }, 4)).resolves.toEqual({ puntoVentaConfigurado: false });
  });

  it("mantiene los otros errores de puntos de venta como fallas de conexion", async () => {
    await expect(checkArcaBillingConnection({
      getVoucherTypes: vi.fn().mockResolvedValue([{ Id: 11 }]),
      getSalesPoints: vi.fn().mockRejectedValue(new Error("credenciales invalidas")),
    }, 4)).rejects.toThrow("credenciales invalidas");
  });

  it("no consulta puntos de venta si ARCA no devuelve tipos de comprobante", async () => {
    const getSalesPoints = vi.fn();

    await expect(checkArcaBillingConnection({
      getVoucherTypes: vi.fn().mockResolvedValue([]),
      getSalesPoints,
    }, 4)).rejects.toBeInstanceOf(FacturacionValidationError);
    expect(getSalesPoints).not.toHaveBeenCalled();
  });

  it("reconoce el campo Nro que devuelve FEParamGetPtosVenta", () => {
    expect(isConfiguredSalesPoint([{ Nro: "4" }], 4)).toBe(true);
    expect(isConfiguredSalesPoint([{ Nro: 2 }], 4)).toBe(false);
  });
});
