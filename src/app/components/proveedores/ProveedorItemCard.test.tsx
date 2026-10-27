import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
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

const mockConfirm = vi.fn();
vi.mock("@/app/providers/ModalMessageProvider", () => ({
  useModalMessage: () => ({
    confirm: mockConfirm,
  }),
}));

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
};
vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => mockToast,
}));

const mockDeleteProveedor = vi.fn();
vi.mock("@/app/providers/ProveedoresProvider", () => ({
  useProveedores: () => ({
    deleteProveedor: mockDeleteProveedor,
  }),
}));

const mockGetOperaciones = vi.fn().mockResolvedValue({ data: null, error: null });
vi.mock("@/clients/proveedores/proveedoresClient", () => ({
  proveedoresClient: {
    getOperaciones: (...args: unknown[]) => mockGetOperaciones(...args),
  },
}));

const mockOpenWhatsapp = vi.fn();
vi.mock("@/lib/whatsapp", () => ({
  openWhatsapp: (...args: unknown[]) => mockOpenWhatsapp(...args),
}));

const mockProveedor: Proveedor = {
  id: "prov-123",
  nombre: "Distribuidora Repuestos",
  cuit: "30-71649281-9",
  telefono: "+54 11 5763-2225",
  email: "contacto@repuestos.com",
  direccion: "Av. Warnes 1420",
  saldo_pendiente: 0,
};

describe("ProveedorItemCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("navega al detalle del proveedor usando ROUTES.proveedorDetalle al hacer click en la tarjeta", () => {
    render(<ProveedorItemCard proveedor={mockProveedor} />);

    const nameEl = screen.getByText("Distribuidora Repuestos");
    fireEvent.click(nameEl);

    expect(mockPush).toHaveBeenCalledWith(ROUTES.proveedorDetalle(mockProveedor.id));
    expect(mockPush).toHaveBeenCalledWith("/proveedores/prov-123");
  });

  it("muestra el saldo 'Al día' cuando el saldo_pendiente es 0", () => {
    render(<ProveedorItemCard proveedor={{ ...mockProveedor, saldo_pendiente: 0 }} />);

    expect(screen.getByTestId("proveedor-clean-amount-prov-123")).toHaveTextContent("$0");
    expect(screen.getByTestId("proveedor-clean-badge-prov-123")).toHaveTextContent("Al día");
  });

  it("muestra el saldo pendiente en rojo cuando tiene deuda", () => {
    render(<ProveedorItemCard proveedor={{ ...mockProveedor, saldo_pendiente: 450000 }} />);

    expect(screen.getByTestId("proveedor-debt-amount-prov-123")).toHaveTextContent("$450.000");
    expect(screen.getByTestId("proveedor-debt-badge-prov-123")).toHaveTextContent("Saldo pendiente");
  });

  it("muestra saldo a favor cuando el saldo_pendiente es negativo", () => {
    render(<ProveedorItemCard proveedor={{ ...mockProveedor, saldo_pendiente: -30000 }} />);

    expect(screen.getByTestId("proveedor-credit-amount-prov-123")).toHaveTextContent("$30.000");
    expect(screen.getByTestId("proveedor-credit-badge-prov-123")).toHaveTextContent("Saldo a favor");
  });

  it("carga el saldo asincrónicamente si saldo_pendiente no viene definido", async () => {
    mockGetOperaciones.mockResolvedValueOnce({
      data: {
        saldoAdeudado: 125000,
        totalComprado: 200000,
        totalPagado: 75000,
        operaciones: [],
      },
      error: null,
    });

    const proveedorSinSaldo: Proveedor = {
      ...mockProveedor,
      id: "prov-async",
      saldo_pendiente: undefined,
    };

    render(<ProveedorItemCard proveedor={proveedorSinSaldo} />);

    expect(mockGetOperaciones).toHaveBeenCalledWith("prov-async");

    await waitFor(() => {
      expect(screen.getByTestId("proveedor-debt-amount-prov-async")).toHaveTextContent("$125.000");
      expect(screen.getByTestId("proveedor-debt-badge-prov-async")).toHaveTextContent("Saldo pendiente");
    });
  });

  it("permite expandir y colapsar los detalles con el botón chevron sin disparar la navegación", () => {
    render(<ProveedorItemCard proveedor={mockProveedor} />);

    const expandBtn = screen.getByTestId("proveedor-expand-btn-prov-123");
    expect(expandBtn).toHaveAttribute("aria-expanded", "false");
    expect(expandBtn).toHaveAttribute("aria-label", "Expandir detalles del proveedor");

    // Click to expand
    fireEvent.click(expandBtn);
    expect(expandBtn).toHaveAttribute("aria-expanded", "true");
    expect(expandBtn).toHaveAttribute("aria-label", "Colapsar detalles del proveedor");
    expect(mockPush).not.toHaveBeenCalled();

    // Click to collapse
    fireEvent.click(expandBtn);
    expect(expandBtn).toHaveAttribute("aria-expanded", "false");
    expect(expandBtn).toHaveAttribute("aria-label", "Expandir detalles del proveedor");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("abre WhatsApp al hacer click en el botón de WhatsApp sin navegar al detalle", () => {
    render(<ProveedorItemCard proveedor={mockProveedor} />);

    const waBtn = screen.getByTestId("proveedor-whatsapp-prov-123");
    fireEvent.click(waBtn);

    expect(mockOpenWhatsapp).toHaveBeenCalledWith(
      mockProveedor.telefono,
      "Hola Distribuidora Repuestos, me comunico desde el taller."
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("llama a onEdit al hacer click en editar sin navegar al detalle", () => {
    const onEdit = vi.fn();
    render(<ProveedorItemCard proveedor={mockProveedor} onEdit={onEdit} />);

    const editBtn = screen.getByTestId("proveedor-edit-prov-123");
    fireEvent.click(editBtn);

    expect(onEdit).toHaveBeenCalledWith(mockProveedor);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("elimina el proveedor si el usuario confirma en el modal sin navegar al detalle", async () => {
    mockConfirm.mockResolvedValueOnce(true);
    render(<ProveedorItemCard proveedor={mockProveedor} />);

    const deleteBtn = screen.getByTestId("proveedor-delete-prov-123");
    fireEvent.click(deleteBtn);

    expect(mockConfirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockDeleteProveedor).toHaveBeenCalledWith(mockProveedor.id);
      expect(mockToast.success).toHaveBeenCalled();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});
