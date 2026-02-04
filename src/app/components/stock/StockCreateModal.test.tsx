import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StockCreateModal from "./StockCreateModal";

const TALLER_ID = "TAL-001";
const mockUpsertStock = vi.fn();
const mockCreateProducto = vi.fn();
const mockOnClose = vi.fn();
const mockOnCreated = vi.fn();

vi.mock("@/app/providers/InventarioProvider", () => ({
  useInventario: () => ({
    upsertStock: mockUpsertStock,
    isLoading: false,
  }),
}));

vi.mock("@/app/providers/ProductosProvider", () => ({
  useProductos: () => ({
    productos: [
      { id: "PROD-001", nombre: "Producto 1", codigo: "P1", categorias: [], precioUnitario: 0, costoUnitario: 0, proveedor: "", ubicacion: "", talleresConStock: 0 },
    ],
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

function renderModal() {
  return render(
    <StockCreateModal
      open
      categoriasDisponibles={["Filtros", "Aceites"]}
      tallerId={TALLER_ID}
      onClose={mockOnClose}
      onCreated={mockOnCreated}
    />
  );
}

describe("StockCreateModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("si el usuario selecciona un producto existente, al crear el stock, se crea, muestra un mensaje de éxito y cierra el modal", async () => {
    mockUpsertStock.mockResolvedValueOnce({ id: "STK-001" });

    renderModal();

    const productoInput = screen.getByTestId("stock-create-modal-producto-autocomplete");
    await userEvent.click(productoInput);
    await userEvent.click(screen.getByText("Producto 1"));
    await userEvent.click(screen.getByTestId("modal-submit"));

    expect(mockCreateProducto).not.toHaveBeenCalled();
    expect(mockUpsertStock).toHaveBeenCalledWith({
      productoId: "PROD-001",
      tallerId: TALLER_ID,
      stockActual: undefined,
      stockMinimo: undefined,
      stockMaximo: undefined,
    });

    expect(toastSuccess).toHaveBeenCalledWith(expect.any(String));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockOnCreated).toHaveBeenCalledWith("STK-001");
  });

  it("si el usuario selecciona 'Crear producto nuevo', se crea el producto y luego se crea el stock, se muestra un mensaje de éxito y se cierra el modal", async () => {
    const newProductoId = "PROD-NEW";
    mockCreateProducto.mockResolvedValueOnce({
      producto: {
        id: newProductoId,
        nombre: "Aceite Nuevo",
        codigo: "ACE-NEW",
        categorias: [],
        precioUnitario: 0,
        costoUnitario: 0,
        proveedor: "",
        ubicacion: "",
        talleresConStock: 0,
      },
      error: null,
    });
    mockUpsertStock.mockResolvedValueOnce({ id: "STK-NEW" });

    renderModal();

    const productoInput = screen.getByTestId("stock-create-modal-producto-autocomplete");
    await userEvent.click(productoInput);
    await userEvent.click(screen.getByText("+ Crear producto"));

    const nombreInput = screen.getByTestId("producto-form-nombre");
    const codigoInput = screen.getByTestId("producto-form-codigo");
    await userEvent.type(nombreInput, "Aceite Nuevo");
    await userEvent.type(codigoInput, "ACE-NEW");

    await userEvent.click(screen.getByTestId("modal-submit"));

    expect(mockCreateProducto).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: "Aceite Nuevo",
        codigo: "ACE-NEW",
      })
    );
    expect(mockUpsertStock).toHaveBeenCalledWith(
      expect.objectContaining({
        productoId: newProductoId,
        tallerId: TALLER_ID,
      })
    );
    expect(toastSuccess).toHaveBeenCalledWith(expect.any(String));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockOnCreated).toHaveBeenCalledWith("STK-NEW");
  });

  it("muestra el error embebido cuando falla el submit", async () => {
    mockUpsertStock.mockRejectedValueOnce(
      new Error('El producto "Producto 1" ya tiene stock definido para "Taller Centro"')
    );

    render(
      <StockCreateModal
        open
        categoriasDisponibles={[]}
        tallerId={TALLER_ID}
        onClose={vi.fn()}
      />
    );

    const productoInput = screen.getByTestId("stock-create-modal-producto-autocomplete");
    await userEvent.click(productoInput);
    await userEvent.click(screen.getByText("Producto 1"));
    await userEvent.click(screen.getByTestId("modal-submit"));

    const errorBox = await screen.findByTestId("modal-error");
    expect(errorBox).toHaveTextContent('El producto "Producto 1" ya tiene stock definido para "Taller Centro"');
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});

