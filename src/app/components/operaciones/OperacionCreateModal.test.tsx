import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { runPendingPromises } from "@/tests/testUtils";
import OperacionCreateModal from "./OperacionCreateModal";

const mockInventario: unknown[] = [];
const mockInventarioApi = {
  inventario: mockInventario,
  isLoading: false,
  loadInventarioByTaller: vi.fn(),
  getStockById: vi.fn(),
  upsertStock: vi.fn(),
  updateStock: vi.fn(),
  removeStock: vi.fn(),
  tallerId: null,
};

vi.mock("@/app/providers/InventarioProvider", () => ({
  useInventario: () => mockInventarioApi,
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

describe("OperacionCreateModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

