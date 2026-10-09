import { describe, expect, it, vi } from "vitest";
import {
  checkArcaBillingConnection,
  FacturacionValidationError,
  isConfiguredSalesPoint,
  parseFacturaNumberSearch,
  parseFacturaIssueInput,
  assertFcePreflightConfirmed,
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

  it("transporta la opción de detalle simplificado y la desactiva por defecto", () => {
    const input = {
      idempotencyKey: "0f4d1ffc-4f57-4aa3-9b8a-92ac56d55700",
      condicionVenta: "CONTADO",
      receptor: {
        tipoDocumento: 99,
        numeroDocumento: null,
        condicionIvaReceptorId: 5,
      },
      fechas: { fechaComprobante: "2026-09-17" },
    };

    expect(parseFacturaIssueInput({ ...input, detalleSimplificado: true }).detalleSimplificado).toBe(true);
    expect(parseFacturaIssueInput(input).detalleSimplificado).toBe(false);
  });

  it("requiere confirmación recuperable aunque la empresa tenga todos los datos FCE", () => {
    const config = { fceCbu: "1234567890123456789012", fceSistema: "ADC" as const };
    expect(() => assertFcePreflightConfirmed(true, false, config)).toThrowError(
      expect.objectContaining({ code: "FCE_DATA_REQUIRED", requiredData: { cbuConfigurado: true, sistema: "ADC" } }),
    );
    expect(() => assertFcePreflightConfirmed(true, true, config)).not.toThrow();
    expect(() => assertFcePreflightConfirmed(false, false, config)).not.toThrow();
  });

  it("transporta como confirmación el estado FCE mostrado por preflight", () => {
    const input = {
      idempotencyKey: "0f4d1ffc-4f57-4aa3-9b8a-92ac56d55700",
      receptor: { tipoDocumento: 80, numeroDocumento: "30712345671", condicionIvaReceptorId: 1 },
      fechas: { fechaComprobante: "2026-09-17" },
    };

    expect(parseFacturaIssueInput(input).fcePreflightConfirmada).toBe(false);
    expect(parseFacturaIssueInput({ ...input, fcePreflightConfirmada: true }).fcePreflightConfirmada).toBe(true);
    // The acknowledgment is informational only; it cannot choose the tax voucher.
    expect(parseFacturaIssueInput({ ...input, fcePreflightConfirmada: true }).fceSistema).toBeNull();
  });

  it("reconoce el número de factura solo y con punto de venta", () => {
    expect(parseFacturaNumberSearch("00001234")).toEqual({ numeroComprobante: 1234 });
    expect(parseFacturaNumberSearch("00001-00001234")).toEqual({
      puntoVenta: 1,
      numeroComprobante: 1234,
    });
    expect(parseFacturaNumberSearch("CAE-1234")).toBeNull();
  });
});
