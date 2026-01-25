import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StockCreateModal from "./StockCreateModal";

const mockUpsertStock = vi.fn();
const mockCreateProducto = vi.fn();
vi.mock("@/app/providers/InventarioProvider", () => ({
  useInventario: () => ({
    upsertStock: mockUpsertStock,
    isLoading: false,
  }),
}));

vi.mock("@/app/providers/ProductosProvider", () => ({
  useProductos: () => ({
    productos: [{ id: "PROD-001", nombre: "Producto 1", codigo: "P1" }],
    createProducto: mockCreateProducto,
    isLoading: false,
  }),
}));

const toastSuccess = vi.fn();
vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: toastSuccess,
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

describe("StockCreateModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra el error embebido cuando falla el submit", async () => {
    mockUpsertStock.mockRejectedValueOnce(
      new Error('El producto "Producto 1" ya tiene stock definido para "Taller Centro"')
    );

    render(
      <StockCreateModal
        open
        categoriasDisponibles={[]}
        tallerId="TAL-001"
        onClose={vi.fn()}
      />
    );

    const productoInput = screen.getByTestId("stock-create-modal-producto-autocomplete");
    await userEvent.click(productoInput);
    await userEvent.click(screen.getByText("Producto 1"));
    await userEvent.click(screen.getByTestId("modal-submit"));

    const errorBox = await screen.findByTestId("stock-create-modal-error");
    expect(errorBox).toHaveTextContent('El producto "Producto 1" ya tiene stock definido para "Taller Centro"');
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});

