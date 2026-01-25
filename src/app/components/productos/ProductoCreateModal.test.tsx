import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProductoCreateModal from "./ProductoCreateModal";

const mockCreateProducto = vi.fn();
vi.mock("@/app/providers/ProductosProvider", () => ({
  useProductos: () => ({
    createProducto: mockCreateProducto,
    isLoading: false,
    productos: [],
    categoriasDisponibles: [],
    loadProductos: vi.fn(),
    getProductoById: vi.fn(),
    updateProducto: vi.fn(),
    removeProducto: vi.fn(),
  }),
}));

describe("ProductoCreateModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("habilita el botón Crear si hay nombre y código", async () => {
    render(
      <ProductoCreateModal
        open
        categoriasDisponibles={[]}
        onClose={vi.fn()}
      />
    );

    const submit = screen.getByTestId("modal-submit");
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByPlaceholderText("Ej: Aceite Motor 10W40 Sintético"), "Aceite");
    await userEvent.type(screen.getByPlaceholderText("Ej: ACE-10W40-SIN"), "ACE-1");

    expect(submit).not.toBeDisabled();
  });
});

