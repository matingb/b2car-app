import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useArregloPrintableInvoice } from "./useArregloPrintableInvoice";
import { createArreglo, createArregloDetalleData, createVehiculo } from "@/tests/factories";

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    error: mocks.toastError,
  }),
}));

describe("useArregloPrintableInvoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inicia con isInvoiceModalOpen en false", () => {
    const { result } = renderHook(() => useArregloPrintableInvoice());
    expect(result.current.isInvoiceModalOpen).toBe(false);
  });

  it("muestra error y no abre el modal si data es nulo o no tiene arreglo", () => {
    const { result } = renderHook(() => useArregloPrintableInvoice());

    act(() => {
      result.current.handleOpenPrintableInvoice(null);
    });

    expect(result.current.isInvoiceModalOpen).toBe(false);
    expect(mocks.toastError).toHaveBeenCalledWith("Error", "No se pudo generar el comprobante");
  });

  it("muestra error si el vehículo no tiene cliente asignado", () => {
    const { result } = renderHook(() => useArregloPrintableInvoice());

    const dataSinCliente = createArregloDetalleData({
      arreglo: createArreglo({
        vehiculo: createVehiculo({
          nombre_cliente: "",
          cliente_id: null,
        }),
      }),
    });

    act(() => {
      result.current.handleOpenPrintableInvoice(dataSinCliente);
    });

    expect(result.current.isInvoiceModalOpen).toBe(false);
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Datos incompletos",
      "El arreglo no tiene un cliente asignado."
    );
  });

  it("abre el modal correctamente cuando el arreglo tiene cliente", () => {
    const { result } = renderHook(() => useArregloPrintableInvoice());

    const dataConCliente = createArregloDetalleData({
      arreglo: createArreglo({
        vehiculo: createVehiculo({
          nombre_cliente: "Carlos Gardel",
          cliente_id: "c1",
        }),
      }),
    });

    act(() => {
      result.current.handleOpenPrintableInvoice(dataConCliente);
    });

    expect(result.current.isInvoiceModalOpen).toBe(true);
    expect(mocks.toastError).not.toHaveBeenCalled();

    act(() => {
      result.current.handleClosePrintableInvoice();
    });

    expect(result.current.isInvoiceModalOpen).toBe(false);
  });

  it("abre el modal cuando el arreglo tiene cliente_id aunque el vehículo no tenga nombre_cliente", () => {
    const { result } = renderHook(() => useArregloPrintableInvoice());

    const dataConClienteId = createArregloDetalleData({
      arreglo: createArreglo({
        cliente_id: "c1",
        vehiculo: createVehiculo({
          nombre_cliente: "",
          cliente_id: null,
        }),
      }),
    });

    act(() => {
      result.current.handleOpenPrintableInvoice(dataConClienteId);
    });

    expect(result.current.isInvoiceModalOpen).toBe(true);
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
