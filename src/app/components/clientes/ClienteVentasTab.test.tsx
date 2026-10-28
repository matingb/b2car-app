import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/testUtils";
import ClienteVentasTab from "./ClienteVentasTab";
import { clientesClient } from "@/clients/clientes/clientesClient";

vi.mock("@/clients/clientes/clientesClient", () => ({
  clientesClient: {
    getOperaciones: vi.fn(),
  },
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}));

vi.mock("@/app/components/operaciones/OperacionCreateModal", () => ({
  default: ({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess?: () => void }) =>
    open ? (
      <div data-testid="mock-create-operacion-modal">
        Modal Crear Venta
        <button type="button" onClick={onSuccess}>
          Confirmar Venta
        </button>
        <button type="button" onClick={onClose}>
          Cerrar
        </button>
      </div>
    ) : null,
}));

const mockOperacionesData = {
  totalVendido: 25000,
  totalCobrado: 15000,
  saldoPendiente: 10000,
  operaciones: [
    {
      id: "op-venta-1",
      tipo: "VENTA",
      fecha: "2026-10-25T14:30:00Z",
      created_at: "2026-10-25T14:30:00Z",
      monto_total: 15000,
      total_pagado: 5000,
      saldo_pendiente: 10000,
      estado_pago: "PARCIAL",
      estado_stock: "PENDIENTE",
      observaciones: "Venta mostrador repuestos",
      taller_id: "taller-central",
      taller_nombre: "Taller Central",
      lineas: [
        {
          id: "lin-1",
          operacion_id: "op-venta-1",
          stock_id: "stk-1",
          cantidad: 2,
          cantidad_cumplida: 0,
          monto_unitario: 7500,
          delta_cantidad: -2,
          created_at: "2026-10-25T14:30:00Z",
          nombre: "Pastillas de freno",
          codigo: "PST-001",
        },
      ],
    },
    {
      id: "op-venta-2",
      tipo: "VENTA",
      fecha: "2026-10-20T10:00:00Z",
      created_at: "2026-10-20T10:00:00Z",
      monto_total: 10000,
      total_pagado: 10000,
      saldo_pendiente: 0,
      estado_pago: "PAGADO",
      estado_stock: "ENTREGADO",
      observaciones: null,
      taller_id: "taller-norte",
      taller_nombre: "Taller Norte",
      lineas: [
        {
          id: "lin-2",
          operacion_id: "op-venta-2",
          stock_id: "stk-2",
          cantidad: 1,
          cantidad_cumplida: 1,
          monto_unitario: 10000,
          delta_cantidad: -1,
          created_at: "2026-10-20T10:00:00Z",
          nombre: "Batería 12V",
          codigo: "BAT-12V",
        },
      ],
    },
  ],
};

describe("ClienteVentasTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza empty card si no hay ventas registradas", async () => {
    vi.mocked(clientesClient.getOperaciones).mockResolvedValueOnce({
      data: { totalVendido: 0, totalCobrado: 0, saldoPendiente: 0, operaciones: [] },
      error: null,
    });

    render(
      <ClienteVentasTab
        clienteId="cli-1"
        clienteNombre="Juan Perez"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Sin ventas registradas")).toBeInTheDocument();
      expect(screen.getByText(/Aún no se han registrado ventas de repuestos/i)).toBeInTheDocument();
    });
  });

  it("renderiza la lista de operaciones", async () => {
    vi.mocked(clientesClient.getOperaciones).mockResolvedValueOnce({
      data: mockOperacionesData,
      error: null,
    });

    render(
      <ClienteVentasTab
        clienteId="cli-1"
        clienteNombre="Juan Perez"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("cliente-venta-card-op-venta-1")).toBeInTheDocument();
      expect(screen.getByTestId("cliente-venta-card-op-venta-2")).toBeInTheDocument();
    });
  });

  it("filtra operaciones usando chips de estado y buscador", async () => {
    vi.mocked(clientesClient.getOperaciones).mockResolvedValueOnce({
      data: mockOperacionesData,
      error: null,
    });

    render(
      <ClienteVentasTab
        clienteId="cli-1"
        clienteNombre="Juan Perez"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("cliente-venta-card-op-venta-1")).toBeInTheDocument();
      expect(screen.getByTestId("cliente-venta-card-op-venta-2")).toBeInTheDocument();
    });

    // Filtro pendientes de cobro
    fireEvent.click(screen.getByTestId("filtro-ventas-pendientes-pago"));
    expect(screen.getByTestId("cliente-venta-card-op-venta-1")).toBeInTheDocument();
    expect(screen.queryByTestId("cliente-venta-card-op-venta-2")).not.toBeInTheDocument();

    // Filtro cobradas
    fireEvent.click(screen.getByTestId("filtro-ventas-pagadas"));
    expect(screen.queryByTestId("cliente-venta-card-op-venta-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("cliente-venta-card-op-venta-2")).toBeInTheDocument();

    // Resetear a todas
    fireEvent.click(screen.getByTestId("filtro-ventas-todos"));
    expect(screen.getByTestId("cliente-venta-card-op-venta-1")).toBeInTheDocument();
    expect(screen.getByTestId("cliente-venta-card-op-venta-2")).toBeInTheDocument();

    // Filtro por buscador
    const searchInput = screen.getByTestId("cliente-ventas-search");
    fireEvent.change(searchInput, { target: { value: "Batería" } });

    expect(screen.queryByTestId("cliente-venta-card-op-venta-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("cliente-venta-card-op-venta-2")).toBeInTheDocument();
  });

  it("abre el modal de 'Nueva Venta' y refresca al completarse", async () => {
    const onVentaUpdated = vi.fn();
    vi.mocked(clientesClient.getOperaciones).mockResolvedValue({
      data: mockOperacionesData,
      error: null,
    });

    render(
      <ClienteVentasTab
        clienteId="cli-1"
        clienteNombre="Juan Perez"
        onVentaUpdated={onVentaUpdated}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("cliente-ventas-nueva-venta-btn")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("cliente-ventas-nueva-venta-btn"));

    expect(screen.getByTestId("mock-create-operacion-modal")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Confirmar Venta"));

    await waitFor(() => {
      expect(screen.queryByTestId("mock-create-operacion-modal")).not.toBeInTheDocument();
    });

    expect(onVentaUpdated).toHaveBeenCalled();
  });

  it("muestra error y permite reintentar si la carga falla", async () => {
    vi.mocked(clientesClient.getOperaciones)
      .mockResolvedValueOnce({
        data: null,
        error: "Fallo de conexión",
      })
      .mockResolvedValueOnce({
        data: mockOperacionesData,
        error: null,
      });

    render(
      <ClienteVentasTab
        clienteId="cli-1"
        clienteNombre="Juan Perez"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Fallo de conexión")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Reintentar/i }));

    await waitFor(() => {
      expect(screen.getByTestId("cliente-venta-card-op-venta-1")).toBeInTheDocument();
    });
  });
});
