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

    render(
      <ProveedorProductosTab
        proveedorId="prov-1"
        proveedorNombre="B2CAR"
        onComprarProducto={onComprar}
      />
    );

    // Esperar a que se carguen los datos
    await waitFor(() => {
      expect(screen.getByText("Filtro de Aceite Blindado PH6017A")).toBeInTheDocument();
    });

    // Columnas
    expect(screen.getByText("PRODUCTO")).toBeInTheDocument();
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
  });

  it("filtra productos al escribir en la barra de búsqueda unificada", async () => {
    vi.mocked(proveedoresClient.getProductos).mockResolvedValue({
      data: mockProductos,
      error: null,
    });

    render(
      <ProveedorProductosTab
        proveedorId="prov-1"
        proveedorNombre="B2CAR"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Filtro de Aceite Blindado PH6017A")).toBeInTheDocument();
      expect(screen.getByText("Kit Correa de Distribución")).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId("proveedor-productos-search");
    fireEvent.change(searchInput, { target: { value: "correa" } });

    expect(screen.getByText("Kit Correa de Distribución")).toBeInTheDocument();
    expect(screen.queryByText("Filtro de Aceite Blindado PH6017A")).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "FLT-6017" } });
    expect(screen.getByText("Filtro de Aceite Blindado PH6017A")).toBeInTheDocument();
    expect(screen.queryByText("Kit Correa de Distribución")).not.toBeInTheDocument();
  });

  it("permite cambiar a la vista de tarjetas con el toggle y ejecutar acciones", async () => {
    vi.mocked(proveedoresClient.getProductos).mockResolvedValue({
      data: mockProductos,
      error: null,
    });

    const onComprar = vi.fn();

    render(
      <ProveedorProductosTab
        proveedorId="prov-1"
        proveedorNombre="B2CAR"
        onComprarProducto={onComprar}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Filtro de Aceite Blindado PH6017A")).toBeInTheDocument();
    });

    // Por defecto está en tabla
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByTestId("proveedor-producto-card-prod-1")).not.toBeInTheDocument();

    // Cambiar a vista de tarjetas
    const cardsToggle = screen.getByTestId("view-toggle-cards");
    fireEvent.click(cardsToggle);

    // Ahora la tabla desaparece y aparecen las cards
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const cardProd1 = screen.getByTestId("proveedor-producto-card-prod-1");
    expect(cardProd1).toBeInTheDocument();

    // Verificamos elementos dentro de la tarjeta
    expect(cardProd1).toHaveTextContent("Filtro de Aceite Blindado PH6017A");
    expect(cardProd1).toHaveTextContent("FLT-6017");
    expect(cardProd1).toHaveTextContent("Stock: 22 un");
    expect(cardProd1).toHaveTextContent("Costo ref.");
    expect(cardProd1).toHaveTextContent("$2.200");
    expect(cardProd1).toHaveTextContent("Venta: $3.800");
    expect(cardProd1).not.toHaveTextContent("Predeterminado");

    // Click en botón Pedir de la tarjeta
    const cardPedirBtn = screen.getByTestId("card-comprar-producto-prod-1");
    fireEvent.click(cardPedirBtn);
    expect(onComprar).toHaveBeenCalledWith("prod-1", "Filtro de Aceite Blindado PH6017A");

    // Cambiar de nuevo a tabla
    const tableToggle = screen.getByTestId("view-toggle-table");
    fireEvent.click(tableToggle);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByTestId("proveedor-producto-card-prod-1")).not.toBeInTheDocument();
  });
});
