import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCondicionPago, CREATE_CUENTA_VALUE } from "./useCondicionPago";

describe("useCondicionPago", () => {
  it("inicializa con cuenta favorita y sincroniza monto con targetAmount", () => {
    const cuentaFavorita = { id: "C-FAV", nombre: "Banco Galicia" };
    const { result, rerender } = renderHook(
      ({ targetAmount }) =>
        useCondicionPago({
          targetAmount,
          cuentaFavorita,
        }),
      { initialProps: { targetAmount: 10000 } }
    );

    expect(result.current.pagosDraft).toHaveLength(1);
    expect(result.current.pagosDraft[0].cuentaId).toBe("C-FAV");
    expect(result.current.pagosDraft[0].monto).toBe("10000");
    expect(result.current.totalPagado).toBe(10000);
    expect(result.current.computedEstadoPago).toBe("PAGADO");
    expect(result.current.isPagoModificado).toBe(false);

    // Cambiar targetAmount: debe sincronizar automáticamente si no fue modificado a mano
    rerender({ targetAmount: 15000 });
    expect(result.current.pagosDraft[0].monto).toBe("15000");
    expect(result.current.totalPagado).toBe(15000);
  });

  it("si el usuario modifica el monto manualmente, no lo sobreescribe al cambiar targetAmount", () => {
    const { result, rerender } = renderHook(
      ({ targetAmount }) =>
        useCondicionPago({
          targetAmount,
          initialCuentaId: "C-1",
        }),
      { initialProps: { targetAmount: 5000 } }
    );

    expect(result.current.pagosDraft[0].monto).toBe("5000");

    // Usuario modifica el monto a 3000
    act(() => {
      result.current.handleUpdatePagoRow(result.current.pagosDraft[0].id, "monto", "3000");
    });

    expect(result.current.isPagoModificado).toBe(true);
    expect(result.current.pagosDraft[0].monto).toBe("3000");
    expect(result.current.computedEstadoPago).toBe("PARCIAL");

    // Cambiar targetAmount a 8000: no debe sobreescribir el 3000 editado a mano
    rerender({ targetAmount: 8000 });
    expect(result.current.pagosDraft[0].monto).toBe("3000");
    expect(result.current.saldoRestante).toBe(5000);
  });

  it("permite agregar filas calculando el saldo restante", () => {
    const { result } = renderHook(() =>
      useCondicionPago({
        targetAmount: 10000,
        initialCuentaId: "C-1",
        cuentasActivas: [{ id: "C-2", nombre: "Caja" }],
      })
    );

    // Editar primera fila a 4000
    act(() => {
      result.current.handleUpdatePagoRow(result.current.pagosDraft[0].id, "monto", "4000");
    });

    // Agregar segunda fila: debe calcular restante = 6000
    act(() => {
      result.current.handleAddPagoRow();
    });

    expect(result.current.pagosDraft).toHaveLength(2);
    expect(result.current.pagosDraft[1].monto).toBe("6000");
    expect(result.current.totalPagado).toBe(10000);
    expect(result.current.computedEstadoPago).toBe("PAGADO");
  });

  it("permite diferir el pago vaciando filas si minRows es 0", () => {
    const { result } = renderHook(() =>
      useCondicionPago({
        targetAmount: 5000,
        initialCuentaId: "C-1",
        minRows: 0,
      })
    );

    act(() => {
      result.current.handleRemovePagoRow(result.current.pagosDraft[0].id);
    });

    expect(result.current.pagosDraft).toHaveLength(0);
    expect(result.current.noPagar).toBe(true);
    expect(result.current.computedEstadoPago).toBe("PENDIENTE");
    expect(result.current.totalPagado).toBe(0);

    // Usar setNoPagar(false) para restaurar
    act(() => {
      result.current.setNoPagar(false);
    });

    expect(result.current.pagosDraft).toHaveLength(1);
    expect(result.current.pagosDraft[0].monto).toBe("5000");
    expect(result.current.computedEstadoPago).toBe("PAGADO");
  });

  it("no permite eliminar la última fila si minRows es 1", () => {
    const { result } = renderHook(() =>
      useCondicionPago({
        targetAmount: 5000,
        initialCuentaId: "C-1",
        minRows: 1,
      })
    );

    act(() => {
      result.current.handleRemovePagoRow(result.current.pagosDraft[0].id);
    });

    // Debe seguir teniendo 1 fila
    expect(result.current.pagosDraft).toHaveLength(1);
  });

  it("permite restaurar la cuenta favorita y resetear la edición manual", () => {
    const cuentaFavorita = { id: "C-FAV", nombre: "Galicia" };
    const { result } = renderHook(() =>
      useCondicionPago({
        targetAmount: 10000,
        cuentaFavorita,
      })
    );

    // Modificar monto y agregar fila
    act(() => {
      result.current.handleUpdatePagoRow(result.current.pagosDraft[0].id, "monto", "4000");
      result.current.handleAddPagoRow();
    });

    expect(result.current.pagosDraft).toHaveLength(2);
    expect(result.current.isPagoModificado).toBe(true);

    // Restaurar favorita
    act(() => {
      result.current.handleRestoreFavorita();
    });

    expect(result.current.pagosDraft).toHaveLength(1);
    expect(result.current.pagosDraft[0].cuentaId).toBe("C-FAV");
    expect(result.current.pagosDraft[0].monto).toBe("10000");
    expect(result.current.isPagoModificado).toBe(false);
  });

  it("resuelve cuentas creadas inline con resolvePagosPayload", async () => {
    const { result } = renderHook(() =>
      useCondicionPago({
        targetAmount: 12000,
        minRows: 0,
      })
    );

    // Modificar primera fila a CREATE_CUENTA_VALUE
    act(() => {
      result.current.handleUpdatePagoRow(result.current.pagosDraft[0].id, "cuentaId", CREATE_CUENTA_VALUE);
      result.current.handleUpdatePagoCuentaDraft(result.current.pagosDraft[0].id, {
        nombre: "Nueva Cuenta Efectivo",
        tipo: "EFECTIVO",
      });
      result.current.handleUpdatePagoRow(result.current.pagosDraft[0].id, "monto", "12000");
    });

    const mockCreateCuenta = vi.fn().mockResolvedValue({
      id: "C-NUEVA-123",
      nombre: "Nueva Cuenta Efectivo",
    });

    let payload: Awaited<ReturnType<typeof result.current.resolvePagosPayload>> = [];
    await act(async () => {
      payload = await result.current.resolvePagosPayload(mockCreateCuenta, "2026-11-07");
    });

    expect(mockCreateCuenta).toHaveBeenCalledWith({
      nombre: "Nueva Cuenta Efectivo",
      tipo: "EFECTIVO",
      saldoInicial: 0,
    });

    expect(payload).toHaveLength(1);
    expect(payload[0].cuenta_id).toBe("C-NUEVA-123");
    expect(payload[0].cuenta_financiera_id).toBe("C-NUEVA-123");
    expect(payload[0].monto).toBe(12000);
  });
});

