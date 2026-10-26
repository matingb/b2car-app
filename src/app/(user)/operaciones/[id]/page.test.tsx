import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { runPendingPromises } from "@/tests/testUtils";
import OperacionDetailPage from "./page";
import type { Operacion } from "@/model/types";

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockGetById = vi.fn();
const mockRemove = vi.fn();
const mockConfirm = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "op-test-1" }),
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

vi.mock("@/clients/operacionesClient", () => ({
  operacionesClient: {
    getById: (...args: unknown[]) => mockGetById(...args),
  },
}));

vi.mock("@/app/providers/OperacionesProvider", () => ({
  useOperaciones: () => ({
    remove: mockRemove,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/app/providers/InventarioProvider", () => ({
  useInventario: () => ({
    getStockById: vi.fn().mockResolvedValue({ id: "stock-1", nombre: "Bujía Bosch", codigo: "BB-01" }),
  }),
}));

vi.mock("@/app/providers/TenantProvider", () => ({
  useTenant: () => ({
    talleres: [{ id: "taller-1", nombre: "Taller Central" }],
    hasPermission: () => true,
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
  }),
}));

vi.mock("@/app/providers/SheetProvider", () => ({
  useSheet: () => ({
    openSheet: vi.fn(),
  }),
}));

vi.mock("@/app/providers/ModalMessageProvider", () => ({
  useModalMessage: () => ({
    confirm: mockConfirm,
  }),
}));

describe("OperacionDetailPage (/operaciones/[id])", () => {
  const operacionVenta: Operacion = {
    id: "11111111-1111-4111-8111-111111111111",
    tipo: "VENTA",
    taller_id: "taller-1",
    fecha: "2026-10-21T12:00:00Z",
    created_at: "2026-10-21T12:00:00Z",
    monto_total: 10000,
    total_pagado: 4000,
    saldo_pendiente: 6000,
    esta_pago: false,
    estado_pago: "PARCIAL",
    estado_stock: "PARCIAL",
    observaciones: "Entregar embalado",
    lineas: [
      {
        id: "linea-1",
        operacion_id: "11111111-1111-4111-8111-111111111111",
        stock_id: "stock-1",
        nombre: "Bujía Bosch",
        codigo: "BB-01",
        cantidad: 10,
        cantidad_cumplida: 7,
        monto_unitario: 1000,
        delta_cantidad: -7,
        created_at: "2026-10-21T12:00:00Z",
      },
    ],
    pagos: [
      {
        id: "pago-1",
        tenant_id: "tenant-1",
        operacion_id: "11111111-1111-4111-8111-111111111111",
        cuenta_financiera_id: "cuenta-1",
        cuenta_financiera_nombre: "Caja Chica",
        monto: 4000,
        fecha: "2026-10-21T12:00:00Z",
        descripcion: "Anticipo en efectivo",
        created_at: "2026-10-21T12:00:00Z",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza el detalle de una venta con métricas, tabla de productos e historial de pagos", async () => {
    mockGetById.mockResolvedValue({ data: operacionVenta, error: null });

    render(<OperacionDetailPage />);
    await runPendingPromises();

    await waitFor(() => {
      expect(screen.getByText(/Venta #11111111/)).toBeInTheDocument();
      expect(screen.getByText(/Taller: Taller Central/)).toBeInTheDocument();
    });

    // Métricas financieras
    expect(screen.getByText("Total Acordado")).toBeInTheDocument();
    expect(screen.getAllByText("$10.000").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Total Cobrado")).toBeInTheDocument();
    expect(screen.getAllByText("$4.000").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Saldo Pendiente")).toBeInTheDocument();
    expect(screen.getByText("$6.000")).toBeInTheDocument();

    // Tabla de productos y cumplimiento parcial
    expect(screen.getByText("Bujía Bosch")).toBeInTheDocument();
    expect(screen.getByText("BB-01")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument(); // Cumplidas
    expect(screen.getByText("3")).toBeInTheDocument(); // Pendientes (10 - 7)

    // Historial de pagos
    expect(screen.getByText("Anticipo en efectivo")).toBeInTheDocument();
    expect(screen.getByText(/Cuenta: Caja Chica/)).toBeInTheDocument();

    // Observaciones
    expect(screen.getByText("Entregar embalado")).toBeInTheDocument();

    // Botones de acción
    expect(screen.getByTestId("operacion-detail-pago-btn")).toBeInTheDocument();
    expect(screen.getByTestId("operacion-detail-stock-btn")).toBeInTheDocument();
  });

  it("redirige automáticamente a /arreglos/[id] cuando la operación es COBRO_ARREGLO", async () => {
    mockGetById.mockResolvedValue({
      data: {
        id: "op-cobro-1",
        tipo: "COBRO_ARREGLO",
        arreglo_id: "arr-uuid-123",
        monto: 25000,
      },
      error: null,
    });

    render(<OperacionDetailPage />);
    await runPendingPromises();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/arreglos/arr-uuid-123");
    });
  });

  it("redirige automáticamente a /cuentas-financieras/[id] cuando es un INGRESO manual", async () => {
    mockGetById.mockResolvedValue({
      data: {
        id: "op-ingreso-1",
        tipo: "INGRESO",
        cuenta_financiera_id: "cuenta-uuid-456",
        monto: 50000,
      },
      error: null,
    });

    render(<OperacionDetailPage />);
    await runPendingPromises();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/cuentas-financieras/cuenta-uuid-456");
    });
  });

  it("muestra pantalla de error si la operación no existe", async () => {
    mockGetById.mockResolvedValue({ data: null, error: "Operación no encontrada" });

    render(<OperacionDetailPage />);
    await runPendingPromises();

    await waitFor(() => {
      expect(screen.getAllByText("Operación no encontrada").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole("button", { name: "Volver a Operaciones" })).toBeInTheDocument();
    });
  });
});
