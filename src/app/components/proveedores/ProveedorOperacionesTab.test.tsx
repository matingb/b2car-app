import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/testUtils";
import ProveedorOperacionesTab from "./ProveedorOperacionesTab";
import { proveedoresClient } from "@/clients/proveedores/proveedoresClient";

vi.mock("@/clients/proveedores/proveedoresClient", () => ({
  proveedoresClient: {
    getOperaciones: vi.fn(),
  },
}));

vi.mock("@/app/components/operaciones/OperacionPagoModal", () => ({
  default: ({ open, operacion, onClose }: { open: boolean; operacion: { id: string }; onClose: () => void }) =>
    open ? (
      <div data-testid="mock-pago-modal">
        Modal Pago para {operacion.id}
        <button type="button" onClick={onClose}>
          Cerrar
        </button>
      </div>
    ) : null,
}));

vi.mock("@/app/components/operaciones/OperacionStockConfirmModal", () => ({
  default: ({ open, operacion, onClose }: { open: boolean; operacion: { id: string }; onClose: () => void }) =>
    open ? (
      <div data-testid="mock-stock-modal">
        Modal Recepción para {operacion.id}
        <button type="button" onClick={onClose}>
          Cerrar
        </button>
      </div>
    ) : null,
}));

const mockOperacionesData = {
  totalComprado: 35000,
  totalPagado: 20000,
  saldoAdeudado: 15000,
  operaciones: [
    {
      id: "op-compra-1",
      tipo: "COMPRA",
      fecha: "2026-10-25T14:30:00Z",
      created_at: "2026-10-25T14:30:00Z",
      monto_total: 20000,
      total_pagado: 5000,
      saldo_pendiente: 15000,
      estado_pago: "PARCIAL",
      estado_stock: "PENDIENTE",
      observaciones: "Entrega urgente de repuestos",
      taller_id: "taller-central",
      taller_nombre: "Taller Central",
      lineas: [
        {
          id: "lin-1",
          operacion_id: "op-compra-1",
          stock_id: "stk-1",
          cantidad: 4,
          cantidad_cumplida: 0,
          monto_unitario: 5000,
          delta_cantidad: 4,
          created_at: "2026-10-25T14:30:00Z",
          nombre: "Pastillas de freno",
          codigo: "PST-001",
        },
      ],
    },
    {
      id: "op-compra-2",
      tipo: "COMPRA",
      fecha: "2026-10-20T10:00:00Z",
      created_at: "2026-10-20T10:00:00Z",
      monto_total: 15000,
      total_pagado: 15000,
      saldo_pendiente: 0,
      estado_pago: "PAGADO",
      estado_stock: "ENTREGADO",
      observaciones: null,
      taller_id: "taller-norte",
      taller_nombre: "Taller Norte",
      lineas: [
        {
          id: "lin-2",
          operacion_id: "op-compra-2",
          stock_id: "stk-2",
          cantidad: 3,
          cantidad_cumplida: 3,
          monto_unitario: 5000,
          delta_cantidad: 3,
          created_at: "2026-10-20T10:00:00Z",
          nombre: "Filtro de aire",
          codigo: "FLT-002",
        },
      ],
    },
  ],
};

describe("ProveedorOperacionesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra estado de carga y luego renderiza las cards de operaciones", async () => {
    vi.mocked(proveedoresClient.getOperaciones).mockResolvedValue({
      data: mockOperacionesData,
      error: null,
    });

    render(
      <ProveedorOperacionesTab
        proveedorId="prov-1"
        proveedorNombre="Repuestos Warnes"
      />
    );

    expect(screen.getByText("Cargando operaciones del proveedor...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("proveedor-operacion-card-op-compra-1")).toBeInTheDocument();
      expect(screen.getByTestId("proveedor-operacion-card-op-compra-2")).toBeInTheDocument();
    });

    // Título y meta en la card colapsada
    expect(screen.getByText("Compra · Pastillas de freno (x4)")).toBeInTheDocument();
    expect(screen.getByText("Compra · Filtro de aire (x3)")).toBeInTheDocument();
    expect(screen.getAllByText("Repuestos Warnes").length).toBeGreaterThan(0);

    // Al hacer click en la card 1, se expande mostrando observaciones y enlace al detalle
    fireEvent.click(screen.getByTestId("proveedor-operacion-card-op-compra-1"));

    expect(screen.getByText("Entrega urgente de repuestos")).toBeInTheDocument();
    expect(screen.getByTestId("operacion-detail-link-op-compra-1")).toBeInTheDocument();
  });

  it("abre el modal de pago al hacer click en el badge de pago", async () => {
    vi.mocked(proveedoresClient.getOperaciones).mockResolvedValue({
      data: mockOperacionesData,
      error: null,
    });

    render(
      <ProveedorOperacionesTab
        proveedorId="prov-1"
        proveedorNombre="Repuestos Warnes"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("proveedor-operacion-card-op-compra-1")).toBeInTheDocument();
    });

    const pagoBadge = screen.getAllByTestId("operacion-pago-badge")[0];
    expect(pagoBadge).toBeInTheDocument();

    fireEvent.click(pagoBadge);

    expect(screen.getByTestId("mock-pago-modal")).toBeInTheDocument();
    expect(screen.getByText("Modal Pago para op-compra-1")).toBeInTheDocument();
  });

  it("filtra operaciones usando los chips de estado y el buscador", async () => {
    vi.mocked(proveedoresClient.getOperaciones).mockResolvedValue({
      data: mockOperacionesData,
      error: null,
    });

    render(
      <ProveedorOperacionesTab
        proveedorId="prov-1"
        proveedorNombre="Repuestos Warnes"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("proveedor-operacion-card-op-compra-1")).toBeInTheDocument();
      expect(screen.getByTestId("proveedor-operacion-card-op-compra-2")).toBeInTheDocument();
    });

    // Filtrar por pagadas
    fireEvent.click(screen.getByTestId("filtro-pagadas"));
    expect(screen.queryByTestId("proveedor-operacion-card-op-compra-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("proveedor-operacion-card-op-compra-2")).toBeInTheDocument();

    // Filtrar por pendientes de pago
    fireEvent.click(screen.getByTestId("filtro-pendientes-pago"));
    expect(screen.getByTestId("proveedor-operacion-card-op-compra-1")).toBeInTheDocument();
    expect(screen.queryByTestId("proveedor-operacion-card-op-compra-2")).not.toBeInTheDocument();

    // Volver a todas
    fireEvent.click(screen.getByTestId("filtro-todos"));

    // Buscar por producto
    const searchInput = screen.getByTestId("proveedor-operaciones-search");
    fireEvent.change(searchInput, { target: { value: "Filtro" } });

    expect(screen.queryByTestId("proveedor-operacion-card-op-compra-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("proveedor-operacion-card-op-compra-2")).toBeInTheDocument();
  });

  it("muestra empty state cuando no hay operaciones y permite invocar onNuevaCompra", async () => {
    const onNuevaCompra = vi.fn();
    vi.mocked(proveedoresClient.getOperaciones).mockResolvedValue({
      data: {
        totalComprado: 0,
        totalPagado: 0,
        saldoAdeudado: 0,
        operaciones: [],
      },
      error: null,
    });

    render(
      <ProveedorOperacionesTab
        proveedorId="prov-1"
        proveedorNombre="Repuestos Warnes"
        onNuevaCompra={onNuevaCompra}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Sin operaciones comerciales")).toBeInTheDocument();
    });

    const registrarBtn = screen.getByText("Registrar Compra");
    fireEvent.click(registrarBtn);

    expect(onNuevaCompra).toHaveBeenCalled();
  });

  it("renderiza y actualiza directamente cuando se pasa resumen controlado desde el padre", async () => {
    const { rerender } = render(
      <ProveedorOperacionesTab
        proveedorId="prov-1"
        proveedorNombre="Repuestos Warnes"
        resumen={{
          totalComprado: 0,
          totalPagado: 0,
          saldoAdeudado: 0,
          operaciones: [],
        }}
        loading={false}
      />
    );

    // No debe llamar a la API redundante porque los datos vienen del padre
    expect(proveedoresClient.getOperaciones).not.toHaveBeenCalled();
    expect(screen.getByText("Sin operaciones comerciales")).toBeInTheDocument();

    // Cuando el padre actualiza el resumen (por ejemplo tras registrar una compra):
    rerender(
      <ProveedorOperacionesTab
        proveedorId="prov-1"
        proveedorNombre="Repuestos Warnes"
        resumen={mockOperacionesData}
        loading={false}
      />
    );

    expect(screen.getByTestId("proveedor-operacion-card-op-compra-1")).toBeInTheDocument();
    expect(screen.getByTestId("proveedor-operacion-card-op-compra-2")).toBeInTheDocument();
  });
});
