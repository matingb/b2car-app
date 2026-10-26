import React from "react";
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/testUtils";
import ProveedorItemCard from "./ProveedorItemCard";
import type { Proveedor } from "@/model/types";
import { ROUTES } from "@/routing/routes";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
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

vi.mock("@/app/providers/ProveedoresProvider", () => ({
  useProveedores: () => ({
    deleteProveedor: vi.fn(),
  }),
}));

const mockProveedor: Proveedor = {
  id: "prov-123",
  nombre: "Distribuidora Repuestos",
  cuit: "30-71649281-9",
  telefono: "+54 11 5763-2225",
  email: "contacto@repuestos.com",
  direccion: "Av. Warnes 1420",
};

describe("ProveedorItemCard", () => {
  it("navega al detalle del proveedor usando ROUTES.proveedorDetalle al hacer click en la tarjeta", () => {
    mockPush.mockClear();

    render(<ProveedorItemCard proveedor={mockProveedor} />);

    const nameEl = screen.getByText("Distribuidora Repuestos");
    fireEvent.click(nameEl);

    expect(mockPush).toHaveBeenCalledWith(ROUTES.proveedorDetalle(mockProveedor.id));
    expect(mockPush).toHaveBeenCalledWith("/proveedores/prov-123");
  });
});
