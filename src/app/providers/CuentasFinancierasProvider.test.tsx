import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CuentaFinanciera } from "@/model/finanzas";

const listarCuentasMock = vi.fn();
const obtenerCuentaMock = vi.fn();
const crearCuentaMock = vi.fn();
const actualizarCuentaMock = vi.fn();
const eliminarCuentaMock = vi.fn();
const crearTransferenciaMock = vi.fn();
const listarMovimientosMock = vi.fn();

vi.mock("@/clients/finanzasClient", () => ({
  finanzasClient: {
    listarCuentas: (...args: unknown[]) => listarCuentasMock(...args),
    obtenerCuenta: (...args: unknown[]) => obtenerCuentaMock(...args),
    crearCuenta: (...args: unknown[]) => crearCuentaMock(...args),
    actualizarCuenta: (...args: unknown[]) => actualizarCuentaMock(...args),
    eliminarCuenta: (...args: unknown[]) => eliminarCuentaMock(...args),
    crearTransferencia: (...args: unknown[]) => crearTransferenciaMock(...args),
    listarMovimientos: (...args: unknown[]) => listarMovimientosMock(...args),
  },
}));

import {
  CuentasFinancierasProvider,
  useCuentasFinancieras,
} from "./CuentasFinancierasProvider";

const initialCuentas: CuentaFinanciera[] = [
  {
    id: "cuenta-1",
    nombre: "Caja Principal",
    tipo: "EFECTIVO",
    saldoInicial: 1000,
    saldoActual: 2500,
    activo: true,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  },
  {
    id: "cuenta-2",
    nombre: "Banco Galicia",
    tipo: "CUENTA_BANCARIA",
    saldoInicial: 5000,
    saldoActual: 8000,
    activo: false,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  },
];

function TestProbe() {
  const {
    cuentas,
    cuentasActivas,
    saldoTotal,
    loading,
    createCuenta,
    updateCuenta,
    deleteCuenta,
    createTransferencia,
    getCuentaById,
  } = useCuentasFinancieras();

  return (
    <div>
      <div data-testid="loading">{loading ? "loading" : "ready"}</div>
      <div data-testid="cuentas-count">{cuentas.length}</div>
      <div data-testid="cuentas-activas-count">{cuentasActivas.length}</div>
      <div data-testid="saldo-total">{saldoTotal}</div>
      <div data-testid="cuenta-1-saldo">
        {cuentas.find((c) => c.id === "cuenta-1")?.saldoActual ?? "none"}
      </div>
      <button
        type="button"
        onClick={() =>
          void createCuenta({
            nombre: "Mercado Pago",
            tipo: "BILLETERA_DIGITAL",
            saldoInicial: 500,
          })
        }
      >
        Crear cuenta
      </button>
      <button
        type="button"
        onClick={() =>
          void updateCuenta("cuenta-1", {
            nombre: "Caja Chica Modificada",
          })
        }
      >
        Actualizar cuenta
      </button>
      <button type="button" onClick={() => void deleteCuenta("cuenta-1")}>
        Eliminar cuenta
      </button>
      <button
        type="button"
        onClick={() =>
          void createTransferencia({
            cuentaOrigenId: "cuenta-1",
            cuentaDestinoId: "cuenta-2",
            importe: 500,
          })
        }
      >
        Transferir
      </button>
      <button
        type="button"
        onClick={() => void getCuentaById("cuenta-1")}
      >
        Obtener cuenta 1
      </button>
    </div>
  );
}

describe("CuentasFinancierasProvider", () => {
  beforeEach(() => {
    listarCuentasMock.mockReset();
    obtenerCuentaMock.mockReset();
    crearCuentaMock.mockReset();
    actualizarCuentaMock.mockReset();
    eliminarCuentaMock.mockReset();
    crearTransferenciaMock.mockReset();
    listarMovimientosMock.mockReset();

    listarCuentasMock.mockResolvedValue({ data: initialCuentas, error: null });
  });

  it("carga cuentas y calcula cuentasActivas y saldoTotal correctamente", async () => {
    render(
      <CuentasFinancierasProvider>
        <TestProbe />
      </CuentasFinancierasProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("ready");
    });

    expect(screen.getByTestId("cuentas-count")).toHaveTextContent("2");
    expect(screen.getByTestId("cuentas-activas-count")).toHaveTextContent("1");
    // Only active account (Caja Principal: 2500) counts towards saldoTotal
    expect(screen.getByTestId("saldo-total")).toHaveTextContent("2500");
  });

  it("permite crear una cuenta y actualiza el estado local", async () => {
    const nuevaCuenta: CuentaFinanciera = {
      id: "cuenta-3",
      nombre: "Mercado Pago",
      tipo: "BILLETERA_DIGITAL",
      saldoInicial: 500,
      saldoActual: 500,
      activo: true,
      createdAt: "2026-07-02T00:00:00Z",
      updatedAt: "2026-07-02T00:00:00Z",
    };
    crearCuentaMock.mockResolvedValue({ data: nuevaCuenta, error: null });

    render(
      <CuentasFinancierasProvider>
        <TestProbe />
      </CuentasFinancierasProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("ready");
    });

    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => {
      expect(screen.getByTestId("cuentas-count")).toHaveTextContent("3");
      expect(screen.getByTestId("cuentas-activas-count")).toHaveTextContent("2");
      expect(screen.getByTestId("saldo-total")).toHaveTextContent("3000");
    });
  });

  it("permite actualizar una cuenta", async () => {
    const cuentaActualizada: CuentaFinanciera = {
      ...initialCuentas[0],
      nombre: "Caja Chica Modificada",
    };
    actualizarCuentaMock.mockResolvedValue({ data: cuentaActualizada, error: null });

    render(
      <CuentasFinancierasProvider>
        <TestProbe />
      </CuentasFinancierasProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("ready");
    });

    fireEvent.click(screen.getByRole("button", { name: "Actualizar cuenta" }));

    await waitFor(() => {
      expect(actualizarCuentaMock).toHaveBeenCalledWith("cuenta-1", {
        nombre: "Caja Chica Modificada",
      });
    });
  });

  it("permite eliminar una cuenta y la remueve del estado local", async () => {
    eliminarCuentaMock.mockResolvedValue({ error: null });

    render(
      <CuentasFinancierasProvider>
        <TestProbe />
      </CuentasFinancierasProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("ready");
    });

    fireEvent.click(screen.getByRole("button", { name: "Eliminar cuenta" }));

    await waitFor(() => {
      expect(screen.getByTestId("cuentas-count")).toHaveTextContent("1");
      expect(screen.getByTestId("saldo-total")).toHaveTextContent("0");
    });
  });

  it("permite registrar transferencia y recarga cuentas", async () => {
    crearTransferenciaMock.mockResolvedValue({
      data: {
        id: "trans-1",
        cuentaOrigenId: "cuenta-1",
        cuentaOrigenNombre: "Caja Principal",
        cuentaDestinoId: "cuenta-2",
        cuentaDestinoNombre: "Banco Galicia",
        importe: 500,
        fecha: "2026-07-02T00:00:00Z",
        descripcion: null,
        reversaEventoId: null,
        createdAt: "2026-07-02T00:00:00Z",
      },
      error: null,
    });

    const updatedCuentas = [
      { ...initialCuentas[0], saldoActual: 2000 },
      { ...initialCuentas[1], saldoActual: 8500 },
    ];
    listarCuentasMock
      .mockResolvedValueOnce({ data: initialCuentas, error: null })
      .mockResolvedValueOnce({ data: updatedCuentas, error: null });

    render(
      <CuentasFinancierasProvider>
        <TestProbe />
      </CuentasFinancierasProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("ready");
    });

    fireEvent.click(screen.getByRole("button", { name: "Transferir" }));

    await waitFor(() => {
      expect(screen.getByTestId("saldo-total")).toHaveTextContent("2000");
    });
  });

  it("actualiza el saldo en el estado global al consultar getCuentaById", async () => {
    obtenerCuentaMock.mockResolvedValue({
      data: { ...initialCuentas[0], saldoActual: 9999 },
      error: null,
    });

    render(
      <CuentasFinancierasProvider>
        <TestProbe />
      </CuentasFinancierasProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("ready");
    });
    expect(screen.getByTestId("cuenta-1-saldo")).toHaveTextContent("2500");

    fireEvent.click(screen.getByRole("button", { name: "Obtener cuenta 1" }));

    await waitFor(() => {
      expect(screen.getByTestId("cuenta-1-saldo")).toHaveTextContent("9999");
      expect(screen.getByTestId("saldo-total")).toHaveTextContent("9999");
    });
  });
});
