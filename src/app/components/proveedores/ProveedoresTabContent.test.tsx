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

const assertVisibleProveedores = (nombresVisibles: string[]) => {
  mockProveedores.forEach((p) => {
    if (nombresVisibles.includes(p.nombre)) {
      expect(screen.getByText(p.nombre)).toBeInTheDocument();
    } else {
      expect(screen.queryByText(p.nombre)).not.toBeInTheDocument();
    }
  });
};

const allNombres = mockProveedores.map((p) => p.nombre);

describe("ProveedoresTabContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      filtro: "Saldo pendiente (> 0)",
      chipTestId: "proveedores-chip-saldo-pendiente",
      visibles: ["Distribuidora Norte"],
    },
    {
      filtro: "Saldo al día (=== 0)",
      chipTestId: "proveedores-chip-saldo-al-dia",
      visibles: ["Autopartes Sur"],
    },
    {
      filtro: "Saldo a favor (< 0)",
      chipTestId: "proveedores-chip-saldo-a-favor",
      visibles: ["Frenos Centro"],
    },
  ])("filtra por chip de $filtro", ({ chipTestId, visibles }) => {
    render(<ProveedoresTabContent />);
    fireEvent.click(screen.getByTestId(chipTestId));
    assertVisibleProveedores(visibles);
  });

  it("permite limpiar los filtros con el botón 'Limpiar filtros'", () => {
    render(<ProveedoresTabContent />);

    fireEvent.click(screen.getByTestId("proveedores-chip-saldo-pendiente"));
    assertVisibleProveedores(["Distribuidora Norte"]);

    fireEvent.click(screen.getByTestId("proveedores-clear-filters"));

    assertVisibleProveedores(allNombres);
    expect(screen.queryByTestId("proveedores-clear-filters")).not.toBeInTheDocument();
  });

  it("combina el buscador de texto con los chips de saldo", () => {
    render(<ProveedoresTabContent />);

    fireEvent.change(screen.getByTestId("proveedores-search"), { target: { value: "Norte" } });
    assertVisibleProveedores(["Distribuidora Norte"]);

    fireEvent.click(screen.getByTestId("proveedores-chip-saldo-al-dia"));

    assertVisibleProveedores([]);
    expect(screen.getByText("No se encontraron proveedores")).toBeInTheDocument();
  });
});
