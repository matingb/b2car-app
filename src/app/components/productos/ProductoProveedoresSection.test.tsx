import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProductoProveedoresSection from "./ProductoProveedoresSection";
import { productosClient } from "@/clients/productosClient";
import { proveedoresClient } from "@/clients/proveedores/proveedoresClient";

vi.mock("@/clients/productosClient", () => ({
  productosClient: {
    getProveedores: vi.fn(),
  },
}));

vi.mock("@/clients/proveedores/proveedoresClient", () => ({
  proveedoresClient: {
    asociarProducto: vi.fn(),
    actualizarProductoVinculado: vi.fn(),
    desvincularProducto: vi.fn(),
  },
}));

vi.mock("@/app/providers/ProveedoresProvider", () => ({
  useProveedores: () => ({
    proveedores: [
      { id: "prov-1", nombre: "Distribuidora Warnes" },
      { id: "prov-2", nombre: "Baterías del Sur" },
    ],
  }),
}));

const mockConfirm = vi.fn();
vi.mock("@/app/providers/ModalMessageProvider", () => ({
  useModalMessage: () => ({
    confirm: mockConfirm,
  }),
}));

const mockSuccess = vi.fn();
const mockError = vi.fn();
vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: mockSuccess,
    error: mockError,
  }),
}));

describe("ProductoProveedoresSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra estado vacío cuando el producto no tiene proveedores asociados", async () => {
    vi.mocked(productosClient.getProveedores).mockResolvedValue({
      data: [],
      error: null,
    });

    render(
      <ProductoProveedoresSection
        productoId="prod-1"
        productoNombre="Filtro de Aceite"
        productoCodigo="FIL-01"
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText("Este producto aún no está vinculado a ningún proveedor.")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("0 proveedores")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vincular a un proveedor" })).toBeInTheDocument();
  });

  it("renderiza la tabla con los proveedores vinculados", async () => {
    vi.mocked(productosClient.getProveedores).mockResolvedValue({
      data: [
        {
          id: "rel-1",
          producto_id: "prod-1",
          proveedor_id: "prov-1",
          proveedor_nombre: "Distribuidora Warnes",
          codigo_proveedor: "WARN-100",
          costo_referencia: 15000,
          es_predeterminado: true,
          created_at: "2026-01-01",
        },
      ],
      error: null,
    });

    render(
      <ProductoProveedoresSection
        productoId="prod-1"
        productoNombre="Filtro de Aceite"
        productoCodigo="FIL-01"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Distribuidora Warnes")).toBeInTheDocument();
    });

    expect(screen.getByText("WARN-100")).toBeInTheDocument();
    expect(screen.getByText("1 proveedor")).toBeInTheDocument();
    expect(screen.getByText("Sí")).toBeInTheDocument();
  });

  it("desvincula un proveedor tras confirmación", async () => {
    vi.mocked(productosClient.getProveedores).mockResolvedValue({
      data: [
        {
          id: "rel-1",
          producto_id: "prod-1",
          proveedor_id: "prov-1",
          proveedor_nombre: "Distribuidora Warnes",
          codigo_proveedor: "WARN-100",
          costo_referencia: 15000,
          es_predeterminado: true,
          created_at: "2026-01-01",
        },
      ],
      error: null,
    });
    mockConfirm.mockResolvedValue(true);
    vi.mocked(proveedoresClient.desvincularProducto).mockResolvedValue({
      data: true,
      error: null,
    });

    render(
      <ProductoProveedoresSection
        productoId="prod-1"
        productoNombre="Filtro de Aceite"
        productoCodigo="FIL-01"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Distribuidora Warnes")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByLabelText("Desvincular Distribuidora Warnes");
    fireEvent.click(deleteBtn);

    expect(mockConfirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(proveedoresClient.desvincularProducto).toHaveBeenCalledWith("prov-1", "prod-1");
      expect(mockSuccess).toHaveBeenCalledWith(
        "Proveedor desvinculado",
        "El vínculo fue eliminado correctamente."
      );
    });
  });
});
