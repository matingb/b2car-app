import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { runPendingPromises } from "@/tests/testUtils";
import { createProducto } from "@/tests/factories";
import { productosClient } from "@/clients/productosClient";
import OperacionCreateModal from "./OperacionCreateModal";

let mockProductos: ReturnType<typeof createProducto>[] = [];
const mockProductosApi = {
  productos: mockProductos,
  isLoading: false,
  loadProductos: vi.fn(),
  getProductoById: vi.fn(),
  updateProducto: vi.fn(),
  removeProducto: vi.fn(),
};

vi.mock("@/app/providers/ProductosProvider", () => ({
  useProductos: () => mockProductosApi,
}));

vi.mock("@/app/components/ui/Autocomplete", () => ({
  __esModule: true,
  default: ({
    value,
    onChange,
    dataTestId,
    disabled,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    dataTestId?: string;
    disabled?: boolean;
    placeholder?: string;
  }) => (
    <input
      data-testid={dataTestId}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("@/app/providers/OperacionesProvider", () => ({
  useOperaciones: () => ({
    create: vi.fn(),
    loading: false,
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock("@/clients/productosClient", () => ({
  productosClient: {
    getAll: vi.fn(),
  },
}));

describe("OperacionCreateModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (productosClient.getAll as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
    });

    mockProductos = [
      createProducto({ id: "PROD-001" }),
      createProducto({ id: "PROD-EXTRA", codigo: "COD-EXTRA" }),
    ];
    mockProductosApi.productos = mockProductos;
  });

  it("si hay un solo taller, no muestra el dropdown de talleres", async () => {
    render(
      <OperacionCreateModal
        open
        talleres={[{ id: "T1", nombre: "Taller Centro" }]}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    expect(screen.queryByTestId("operaciones-create-taller")).not.toBeInTheDocument();
    expect(screen.queryByText("Taller")).not.toBeInTheDocument();
  });

  it("si hay una única línea, no aparece el icono de eliminar", async () => {
    render(
      <OperacionCreateModal
        open
        talleres={[{ id: "T1", nombre: "Taller Centro" }]}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    expect(screen.getByTestId("operaciones-line-0")).toBeInTheDocument();
    expect(screen.queryByTestId("operaciones-line-0-remove")).not.toBeInTheDocument();
  });

  it("si hay dos líneas, aparece el icono de eliminar en ambas", async () => {
    render(
      <OperacionCreateModal
        open
        talleres={[{ id: "T1", nombre: "Taller Centro" }]}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    await userEvent.click(screen.getByTestId("operaciones-add-line"));
    await runPendingPromises();

    expect(screen.getByTestId("operaciones-line-0")).toBeInTheDocument();
    expect(screen.getByTestId("operaciones-line-1")).toBeInTheDocument();
    expect(screen.getByTestId("operaciones-line-0-remove")).toBeInTheDocument();
    expect(screen.getByTestId("operaciones-line-1-remove")).toBeInTheDocument();
  });
});

