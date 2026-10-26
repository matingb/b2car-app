import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/testUtils";
import ProveedorDetailPage from "./page";
import { proveedoresClient } from "@/clients/proveedores/proveedoresClient";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "prov-123" }),
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock("@/app/providers/ProveedoresProvider", () => ({
  useProveedores: () => ({
    updateProveedor: vi.fn(),
    deleteProveedor: vi.fn(),
  }),
}));

vi.mock("@/app/providers/ModalMessageProvider", () => ({
  useModalMessage: () => ({
    confirm: vi.fn(),
    alert: vi.fn(),
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/app/providers/SheetProvider", () => ({
  SheetProvider: ({ children }: { children: React.ReactNode }) => children,
  useSheet: () => ({
    openSheet: vi.fn(),
    closeSheet: vi.fn(),
  }),
}));

vi.mock("@/clients/proveedores/proveedoresClient", () => ({
  proveedoresClient: {
    getById: vi.fn(),
    getOperaciones: vi.fn(),
    getProductos: vi.fn(),
  },
}));

vi.mock("@/app/components/proveedores/ProveedorProductosTab", () => ({
  default: ({ proveedorNombre }: { proveedorNombre: string }) => (
    <div data-testid="mock-productos-tab">Pestaña Productos de {proveedorNombre}</div>
  ),
}));

vi.mock("@/app/components/proveedores/ProveedorCuentaCorrienteTab", () => ({
  default: () => <div data-testid="mock-cuentacorriente-tab">Pestaña Cuenta Corriente</div>,
}));

const mockProveedor = {
  id: "prov-123",
  nombre: "B2CAR",
  cuit: "30-71649281-9",
  telefono: "+54 11 5763-2225",
  email: "contacto@b2car.com.ar",
  direccion: "Av. Warnes 1420, Chacarita, CABA",
};

const mockCuentaCorriente = {
  totalComprado: 100000,
  totalPagado: 100000,
  saldoAdeudado: 0,
  operaciones: [
    {
      id: "op-1",
      tipo: "COMPRA",
      fecha: "2026-10-21",
      created_at: "2026-10-21T10:00:00Z",
      monto_total: 100000,
      total_pagado: 100000,
      saldo_pendiente: 0,
      estado_pago: "PAGADO",
      estado_stock: "ENTREGADO",
      observaciones: null,
      taller_id: "taller-1",
      taller_nombre: "Taller Central",
    },
  ],
};

describe("ProveedorDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza la vista con el perfil arriba, tabs abajo y productos por defecto", async () => {
    vi.mocked(proveedoresClient.getById).mockResolvedValue({
      data: mockProveedor,
      error: null,
    });
    vi.mocked(proveedoresClient.getOperaciones).mockResolvedValue({
      data: mockCuentaCorriente,
      error: null,
    });

    render(<ProveedorDetailPage />);

    // Esperar a que cargue
    await waitFor(() => {
      expect(screen.getByText("B2CAR")).toBeInTheDocument();
    });

    // Información de arriba (siguiendo esquema de clientes)
    expect(screen.getByText("B2")).toBeInTheDocument();
    expect(screen.getByText("Av. Warnes 1420, Chacarita, CABA")).toBeInTheDocument();
    expect(screen.getByText("Al día")).toBeInTheDocument();
    expect(screen.getByText("DATOS DE CONTACTO Y FISCALES")).toBeInTheDocument();
    expect(screen.getByText("contacto@b2car.com.ar")).toBeInTheDocument();

    // Tabs en la parte inferior
    const tabProductos = screen.getByTestId("proveedor-tab-productos");
    const tabCuentaCorriente = screen.getByTestId("proveedor-tab-cuentacorriente");

    expect(tabProductos).toBeInTheDocument();
    expect(tabCuentaCorriente).toBeInTheDocument();

    // Por defecto muestra la pestaña de productos
    expect(screen.getByTestId("mock-productos-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-cuentacorriente-tab")).not.toBeInTheDocument();

    // Al hacer click en Cuenta Corriente, cambia la vista
    fireEvent.click(tabCuentaCorriente);
    expect(screen.getByTestId("mock-cuentacorriente-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-productos-tab")).not.toBeInTheDocument();
  });
});
