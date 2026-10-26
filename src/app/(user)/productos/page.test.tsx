import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProductosPage from "./page";

const mockPush = vi.fn();
let mockSearchParamsTab: string | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: (key: string) => (key === "tab" ? mockSearchParamsTab : null),
  }),
}));

vi.mock("@/app/components/auth/Can", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/app/providers/TenantProvider", () => ({
  useTenant: () => ({
    talleres: [],
    hasPermission: () => true,
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/app/components/ui/TallerSelector", () => ({
  default: () => <div data-testid="taller-selector" />,
}));

vi.mock("@/app/providers/ProductosProvider", () => ({
  useProductos: () => ({
    productos: [
      {
        id: "prod-1",
        codigo: "FIL-01",
        nombre: "Filtro de Aceite",
        precioUnitario: 1000,
        costoUnitario: 500,
        proveedor: "Distribuidora",
        categorias: ["Filtros"],
        showInStock: true,
        stocks: [],
      },
    ],
    categoriasDisponibles: ["Filtros"],
    isLoading: false,
  }),
}));

vi.mock("@/app/providers/ProveedoresProvider", () => ({
  useProveedores: () => ({
    proveedores: [
      {
        id: "prov-1",
        nombre: "Distribuidora Warnes SRL",
      },
    ],
    loading: false,
  }),
}));

vi.mock("@/app/components/ui/ScreenHeader", () => ({
  default: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div data-testid="screen-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));

vi.mock("@/app/components/proveedores/ProveedoresTabContent", () => ({
  default: () => <div data-testid="proveedores-tab-content">Contenido de Proveedores</div>,
}));

describe("ProductosPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsTab = null;
  });

  it("renderiza la pestaña de Productos por defecto con sus controles", () => {
    render(<ProductosPage />);

    expect(screen.getByRole("heading", { name: "Productos" })).toBeInTheDocument();
    expect(screen.getByText("Catálogo de Productos")).toBeInTheDocument();
    expect(screen.getByText("Filtro de Aceite")).toBeInTheDocument();
    expect(screen.queryByTestId("proveedores-tab-content")).not.toBeInTheDocument();
  });

  it("renderiza la pestaña de Proveedores cuando el query param tab=proveedores", () => {
    mockSearchParamsTab = "proveedores";
    render(<ProductosPage />);

    expect(screen.getByRole("heading", { name: "Proveedores" })).toBeInTheDocument();
    expect(screen.getByTestId("proveedores-tab-content")).toBeInTheDocument();
    expect(screen.queryByText("Filtro de Aceite")).not.toBeInTheDocument();
  });

  it("navega a /productos?tab=proveedores al hacer click en la pestaña de Proveedores", () => {
    render(<ProductosPage />);

    fireEvent.click(screen.getByTestId("tab-proveedores"));
    expect(mockPush).toHaveBeenCalledWith("/productos?tab=proveedores");
  });
});
