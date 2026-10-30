import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { runPendingPromises } from "@/tests/testUtils";
import OperacionDetailPage from "./page";
import type { Operacion } from "@/model/types";

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockGetById = vi.fn();
const mockRemove = vi.fn();
const mockRevertirStock = vi.fn();
const mockAnularPago = vi.fn();
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
    revertirStock: mockRevertirStock,
    anularPago: mockAnularPago,
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

    // Badges interactivos (formato unificado como en detalle de arreglo)
    expect(screen.getAllByTestId("operacion-pago-badge").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("operacion-estado-stock-badge").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId("operacion-detail-pago-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("operacion-detail-stock-btn")).not.toBeInTheDocument();

    // Acciones principales en el header estilo detalle de arreglo (IconButton)
    expect(screen.getByRole("button", { name: "Facturar electrónicamente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generar remito" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar venta" })).toBeInTheDocument();
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

  it("renderiza el historial de entregas de una venta cuando tiene movimientos_stock", async () => {
    const ventaConEntregas: Operacion = {
      ...operacionVenta,
      movimientos_stock: [
        {
          id: "mov-entrega-1",
          fecha: "2026-10-21T14:30:00Z",
          cantidad: -7,
          saldo_anterior: 20,
          saldo_posterior: 13,
          motivo: "Entrega inicial al cliente",
          created_at: "2026-10-21T14:30:00Z",
          producto_id: "prod-1",
          stock_id: "stock-1",
          producto_nombre: "Bujía Bosch",
          producto_codigo: "BB-01",
        },
      ],
    };

    mockGetById.mockResolvedValue({ data: ventaConEntregas, error: null });

    render(<OperacionDetailPage />);
    await runPendingPromises();

    await waitFor(() => {
      expect(screen.getByText(/Historial de Entregas \(1\)/)).toBeInTheDocument();
    });

    expect(screen.getByTestId("operacion-stock-history-table")).toBeInTheDocument();
    expect(screen.getByText("-7 un.")).toBeInTheDocument();
    expect(screen.getByText("Entrega inicial al cliente")).toBeInTheDocument();
    expect(screen.queryByText("Stock Taller")).not.toBeInTheDocument();
    expect(screen.getByTestId("btn-revertir-stock-mov-entrega-1")).toBeInTheDocument();
  });

  it("permite revertir un movimiento de entrega desde la tabla del historial", async () => {
    const ventaConEntregas: Operacion = {
      ...operacionVenta,
      movimientos_stock: [
        {
          id: "mov-stock-1",
          fecha: "2026-10-21T14:00:00Z",
          cantidad: -7,
          saldo_anterior: 20,
          saldo_posterior: 13,
          motivo: "Entrega inicial al cliente",
          created_at: "2026-10-21T14:00:00Z",
          producto_id: "prod-1",
          stock_id: "stock-1",
          producto_nombre: "Bujía Bosch",
          producto_codigo: "BB-01",
        },
      ],
    };

    mockGetById.mockResolvedValue({ data: ventaConEntregas, error: null });
    mockConfirm.mockResolvedValue(true);
    mockRevertirStock.mockResolvedValue({
      ...ventaConEntregas,
      estado_stock: "PENDIENTE",
      movimientos_stock: [
        {
          ...ventaConEntregas.movimientos_stock![0],
          revertido: true,
        },
      ],
    });

    render(<OperacionDetailPage />);
    await runPendingPromises();

    await waitFor(() => {
      expect(screen.getByTestId("btn-revertir-stock-mov-stock-1")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("btn-revertir-stock-mov-stock-1"));
    });

    expect(mockConfirm).toHaveBeenCalled();
    expect(mockRevertirStock).toHaveBeenCalledWith(ventaConEntregas.id, "mov-stock-1");
    expect(mockToastSuccess).toHaveBeenCalledWith("Entrega revertida", expect.stringContaining("7 u."));
  });

  it("muestra el badge Revertido y no el botón si el movimiento ya fue revertido", async () => {
    const ventaConRevertido: Operacion = {
      ...operacionVenta,
      movimientos_stock: [
        {
          id: "mov-stock-1",
          fecha: "2026-10-21T14:00:00Z",
          cantidad: -7,
          saldo_anterior: 20,
          saldo_posterior: 13,
          motivo: "Entrega inicial al cliente",
          created_at: "2026-10-21T14:00:00Z",
          producto_id: "prod-1",
          stock_id: "stock-1",
          producto_nombre: "Bujía Bosch",
          producto_codigo: "BB-01",
          revertido: true,
        },
      ],
    };

    mockGetById.mockResolvedValue({ data: ventaConRevertido, error: null });

    render(<OperacionDetailPage />);
    await runPendingPromises();

    await waitFor(() => {
      expect(screen.getByText("Revertido")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("btn-revertir-stock-mov-stock-1")).not.toBeInTheDocument();
  });

  it("renderiza el historial de recepciones de una compra cuando tiene movimientos_stock", async () => {
    const operacionCompra: Operacion = {
      id: "22222222-2222-4222-8222-222222222222",
      tipo: "COMPRA",
      taller_id: "taller-1",
      fecha: "2026-10-22T10:00:00Z",
      created_at: "2026-10-22T10:00:00Z",
      monto_total: 50000,
      total_pagado: 50000,
      saldo_pendiente: 0,
      esta_pago: true,
      estado_pago: "PAGADO",
      estado_stock: "ENTREGADO",
      lineas: [
        {
          id: "linea-c-1",
          operacion_id: "22222222-2222-4222-8222-222222222222",
          stock_id: "stock-1",
          nombre: "Bujía Bosch",
          codigo: "BB-01",
          cantidad: 15,
          cantidad_cumplida: 15,
          monto_unitario: 800,
          delta_cantidad: 15,
          created_at: "2026-10-22T10:00:00Z",
        },
      ],
      movimientos_stock: [
        {
          id: "mov-compra-1",
          fecha: "2026-10-22T11:00:00Z",
          cantidad: 15,
          saldo_anterior: 5,
          saldo_posterior: 20,
          motivo: "Recepción de proveedor",
          created_at: "2026-10-22T11:00:00Z",
          producto_id: "prod-1",
          stock_id: "stock-1",
          producto_nombre: "Bujía Bosch",
          producto_codigo: "BB-01",
        },
      ],
    };

    mockGetById.mockResolvedValue({ data: operacionCompra, error: null });

    render(<OperacionDetailPage />);
    await runPendingPromises();

    await waitFor(() => {
      expect(screen.getByText(/Historial de Recepciones \(1\)/)).toBeInTheDocument();
    });

    expect(screen.getByText("+15 un.")).toBeInTheDocument();
    expect(screen.getByText("Recepción de proveedor")).toBeInTheDocument();
    expect(screen.queryByText("Stock Taller")).not.toBeInTheDocument();
  });

  it("muestra estado vacío informativo cuando una venta no tiene entregas registradas", async () => {
    const ventaSinEntregas: Operacion = {
      ...operacionVenta,
      estado_stock: "PENDIENTE",
      movimientos_stock: [],
    };

    mockGetById.mockResolvedValue({ data: ventaSinEntregas, error: null });

    render(<OperacionDetailPage />);
    await runPendingPromises();

    await waitFor(() => {
      expect(screen.getByTestId("operacion-stock-history-empty")).toBeInTheDocument();
      expect(
        screen.getByText("Aún no se han registrado entregas físicas de mercadería para esta venta.")
      ).toBeInTheDocument();
    });
  });

  it("permite colapsar y desplegar el historial de entregas mostrando badge y subtítulo resumen", async () => {
    const ventaConEntregas: Operacion = {
      ...operacionVenta,
      movimientos_stock: [
        {
          id: "mov-entrega-1",
          fecha: "2026-10-27T10:00:00Z",
          cantidad: -1,
          saldo_anterior: 5,
          saldo_posterior: 4,
          motivo: "Entrega al cliente",
          created_at: "2026-10-27T10:00:00Z",
          producto_id: "prod-1",
          stock_id: "stock-1",
          producto_nombre: "Bujía Bosch",
          producto_codigo: "BB-01",
        },
      ],
    };

    mockGetById.mockResolvedValue({ data: ventaConEntregas, error: null });

    render(<OperacionDetailPage />);
    await runPendingPromises();

    await waitFor(() => {
      expect(screen.getByTestId("operacion-stock-history-toggle")).toBeInTheDocument();
    });

    const toggleBtn = screen.getByTestId("operacion-stock-history-toggle");
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("1 registrada(s)")).toBeInTheDocument();
    expect(screen.getByText(/Última entrega: 27\/10\/2026 \(-1 un\.\)/)).toBeInTheDocument();

    // Desplegar historial
    await act(async () => {
      fireEvent.click(toggleBtn);
    });
    expect(toggleBtn).toHaveAttribute("aria-expanded", "true");

    // Colapsar historial
    await act(async () => {
      fireEvent.click(toggleBtn);
    });
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
  });

  it("permite colapsar y desplegar el historial de pagos mostrando badge con el total", async () => {
    mockGetById.mockResolvedValue({ data: operacionVenta, error: null });

    render(<OperacionDetailPage />);
    await runPendingPromises();

    await waitFor(() => {
      expect(screen.getByTestId("operacion-pagos-history-toggle")).toBeInTheDocument();
    });

    const toggleBtn = screen.getByTestId("operacion-pagos-history-toggle");
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Total: $4.000")).toBeInTheDocument();

    // Desplegar historial
    await act(async () => {
      fireEvent.click(toggleBtn);
    });
    expect(toggleBtn).toHaveAttribute("aria-expanded", "true");

    // Colapsar historial
    await act(async () => {
      fireEvent.click(toggleBtn);
    });
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
  });

  it("permite anular un pago desde el historial de pagos del detalle", async () => {
    mockGetById.mockResolvedValue({ data: operacionVenta, error: null });
    mockConfirm.mockResolvedValue(true);
    mockAnularPago.mockResolvedValue({ ...operacionVenta, pagos: [], total_pagado: 0 });

    render(<OperacionDetailPage />);
    await runPendingPromises();

    await waitFor(() => {
      expect(screen.getByTestId("btn-anular-pago-pago-1")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("btn-anular-pago-pago-1"));
    });

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Anular cobro", acceptLabel: "Anular cobro" })
    );
    expect(mockAnularPago).toHaveBeenCalledWith(operacionVenta.id, "pago-1");
    expect(mockToastSuccess).toHaveBeenCalledWith("Cobro anulado", expect.any(String));
  });
});
