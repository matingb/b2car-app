import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/testUtils";
import ProveedorProductosTab from "./ProveedorProductosTab";
import { proveedoresClient } from "@/clients/proveedores/proveedoresClient";

vi.mock("@/clients/proveedores/proveedoresClient", () => ({
  proveedoresClient: {
    getProductos: vi.fn(),
    desvincularProducto: vi.fn(),
  },
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

vi.mock("./ProveedorProductoModal", () => ({
  default: () => null,
}));

const mockProductos = [
  {
    id: "pp-1",
    producto_id: "prod-1",
    proveedor_id: "prov-1",
    producto_nombre: "Filtro de Aceite Blindado PH6017A",
    producto_codigo: "FLT-6017",
    codigo_proveedor: "FLT-6017",
    producto_categoria: "Filtros",
    costo_referencia: 2200,
    producto_precio_venta: 3800,
    es_predeterminado: true,
    stock_actual: 22,
    created_at: "2026-10-21T12:00:00Z",
  },
  {
    id: "pp-2",
    producto_id: "prod-2",
    proveedor_id: "prov-1",
    producto_nombre: "Kit Correa de Distribución",
    producto_codigo: "KTT-GAT-90",
    codigo_proveedor: "KTT-GAT-90",
    producto_categoria: "Motor",
    costo_referencia: 34000,
    producto_precio_venta: 52000,
    es_predeterminado: false,
    stock_actual: 0,
    created_at: "2026-10-05T10:00:00Z",
  },
];

describe("ProveedorProductosTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza la tabla con columnas del mockup y productos vinculados", async () => {
    vi.mocked(proveedoresClient.getProductos).mockResolvedValue({
      data: mockProductos,
      error: null,
    });

    const onComprar = vi.fn();
    const onCountChange = vi.fn();

    render(
      <ProveedorProductosTab
        proveedorId="prov-1"
        proveedorNombre="B2CAR"
        onComprarProducto={onComprar}
        onCountChange={onCountChange}
      />
    );

    // Esperar a que se carguen los datos
    await waitFor(() => {
      expect(screen.getByText("Filtro de Aceite Blindado PH6017A")).toBeInTheDocument();
    });

    // Columnas
    expect(screen.getByText("PRODUCTO & SKU")).toBeInTheDocument();
    expect(screen.getByText("STOCK ACTUAL")).toBeInTheDocument();
    expect(screen.getByText("PRECIO COSTO")).toBeInTheDocument();
    expect(screen.getByText("VENTA SUGERIDA")).toBeInTheDocument();
    expect(screen.queryByText("ÚLTIMA COMPRA")).not.toBeInTheDocument();
    expect(screen.queryByText("ENTREGA")).not.toBeInTheDocument();
    expect(screen.getByText("ACCIÓN")).toBeInTheDocument();

    // Valores calculados
    expect(screen.getByText(/\+73% margen/)).toBeInTheDocument();
    expect(screen.getByText("22 un")).toBeInTheDocument();
    expect(screen.getByText("0 un")).toBeInTheDocument();

    // Acción Pedir
    const pedirButtons = screen.getAllByRole("button", { name: /pedir/i });
    expect(pedirButtons).toHaveLength(2);

    fireEvent.click(pedirButtons[0]);
    expect(onComprar).toHaveBeenCalledWith("prod-1", "Filtro de Aceite Blindado PH6017A");

    expect(onCountChange).toHaveBeenCalledWith(2);
  });
});
