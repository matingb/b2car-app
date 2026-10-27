import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/testUtils";
import ProveedoresTabContent from "./ProveedoresTabContent";
import type { Proveedor } from "@/model/types";

const mockProveedores: Proveedor[] = [
  {
    id: "prov-1",
    nombre: "Distribuidora Norte",
    cuit: "30-11111111-1",
    telefono: "1145678900",
    saldo_pendiente: 50000, // Con deuda
  },
  {
    id: "prov-2",
    nombre: "Autopartes Sur",
    cuit: "30-22222222-2",
    telefono: "1155556666",
    saldo_pendiente: 0, // Al día
  },
  {
    id: "prov-3",
    nombre: "Frenos Centro",
    cuit: "30-33333333-3",
    telefono: "1177778888",
    saldo_pendiente: -12000, // A favor
  },
];

const mockCreateProveedor = vi.fn();
const mockUpdateProveedor = vi.fn();

vi.mock("@/app/providers/ProveedoresProvider", () => ({
  useProveedores: () => ({
    proveedores: mockProveedores,
    loading: false,
    createProveedor: mockCreateProveedor,
    updateProveedor: mockUpdateProveedor,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/app/providers/ModalMessageProvider", () => ({
  useModalMessage: () => ({
    confirm: vi.fn(),
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("ProveedoresTabContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza todos los proveedores por defecto", () => {
    render(<ProveedoresTabContent />);

    expect(screen.getByText("Distribuidora Norte")).toBeInTheDocument();
    expect(screen.getByText("Autopartes Sur")).toBeInTheDocument();
    expect(screen.getByText("Frenos Centro")).toBeInTheDocument();
    expect(screen.getByText("3 proveedores")).toBeInTheDocument();
  });

  it("filtra por chip de 'Saldo pendiente' mostrando solo proveedores con saldo > 0", () => {
    render(<ProveedoresTabContent />);

    const chipPendiente = screen.getByTestId("proveedores-chip-saldo-pendiente");
    fireEvent.click(chipPendiente);

    expect(screen.getByText("Distribuidora Norte")).toBeInTheDocument();
    expect(screen.queryByText("Autopartes Sur")).not.toBeInTheDocument();
    expect(screen.queryByText("Frenos Centro")).not.toBeInTheDocument();
    expect(screen.getByText("1 de 3 proveedores")).toBeInTheDocument();
  });

  it("filtra por chip de 'Saldo al día' mostrando solo proveedores con saldo === 0", () => {
    render(<ProveedoresTabContent />);

    const chipAlDia = screen.getByTestId("proveedores-chip-saldo-al-dia");
    fireEvent.click(chipAlDia);

    expect(screen.queryByText("Distribuidora Norte")).not.toBeInTheDocument();
    expect(screen.getByText("Autopartes Sur")).toBeInTheDocument();
    expect(screen.queryByText("Frenos Centro")).not.toBeInTheDocument();
    expect(screen.getByText("1 de 3 proveedores")).toBeInTheDocument();
  });

  it("filtra por chip de 'Saldo a favor' mostrando solo proveedores con saldo < 0", () => {
    render(<ProveedoresTabContent />);

    const chipAFavor = screen.getByTestId("proveedores-chip-saldo-a-favor");
    fireEvent.click(chipAFavor);

    expect(screen.queryByText("Distribuidora Norte")).not.toBeInTheDocument();
    expect(screen.queryByText("Autopartes Sur")).not.toBeInTheDocument();
    expect(screen.getByText("Frenos Centro")).toBeInTheDocument();
    expect(screen.getByText("1 de 3 proveedores")).toBeInTheDocument();
  });

  it("permite limpiar los filtros con el botón 'Limpiar filtros'", () => {
    render(<ProveedoresTabContent />);

    const chipPendiente = screen.getByTestId("proveedores-chip-saldo-pendiente");
    fireEvent.click(chipPendiente);
    expect(screen.queryByText("Autopartes Sur")).not.toBeInTheDocument();

    const clearBtn = screen.getByTestId("proveedores-clear-filters");
    fireEvent.click(clearBtn);

    expect(screen.getByText("Distribuidora Norte")).toBeInTheDocument();
    expect(screen.getByText("Autopartes Sur")).toBeInTheDocument();
    expect(screen.getByText("Frenos Centro")).toBeInTheDocument();
    expect(screen.queryByTestId("proveedores-clear-filters")).not.toBeInTheDocument();
  });

  it("combina el buscador de texto con los chips de saldo", () => {
    render(<ProveedoresTabContent />);

    const searchInput = screen.getByTestId("proveedores-search");
    fireEvent.change(searchInput, { target: { value: "Norte" } });

    expect(screen.getByText("Distribuidora Norte")).toBeInTheDocument();
    expect(screen.queryByText("Autopartes Sur")).not.toBeInTheDocument();

    const chipAlDia = screen.getByTestId("proveedores-chip-saldo-al-dia");
    fireEvent.click(chipAlDia);

    // Norte no está al día, por lo que el resultado queda vacío
    expect(screen.queryByText("Distribuidora Norte")).not.toBeInTheDocument();
    expect(screen.getByText("No se encontraron proveedores")).toBeInTheDocument();
  });
});
