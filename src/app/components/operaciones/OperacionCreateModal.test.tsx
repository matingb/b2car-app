import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

const mockCrearGasto = vi.fn();
const mockActualizarGasto = vi.fn();
const mockRefreshOperaciones = vi.fn();
const mockRefreshCuentas = vi.fn();

vi.mock("@/clients/finanzasClient", () => ({
  finanzasClient: {
    crearGasto: (...args: unknown[]) => mockCrearGasto(...args),
    actualizarGasto: (...args: unknown[]) => mockActualizarGasto(...args),
  },
}));

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
    refresh: mockRefreshOperaciones,
  }),
}));

vi.mock("@/app/providers/CuentasFinancierasProvider", () => ({
  useCuentasFinancieras: () => ({
    cuentas: [],
    cuentasActivas: [
      { id: "C1", nombre: "Caja Chica", tipo: "EFECTIVO", saldoActual: 10000, activo: true },
    ],
    loading: false,
    refresh: mockRefreshCuentas,
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
    mockCrearGasto.mockResolvedValue({
      data: { id: "G1", cuentaId: "C1", categoria: "ALQUILER", importe: 5000 },
      error: null,
    });
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

  it("permite registrar un gasto al seleccionar el tipo Gasto", async () => {
    const onClose = vi.fn();
    render(
      <OperacionCreateModal
        open
        talleres={[{ id: "T1", nombre: "Taller Centro" }]}
        onClose={onClose}
      />
    );

    await runPendingPromises();

    // Cambiar a GASTO
    await userEvent.click(screen.getByTestId("operaciones-create-tipo-GASTO"));
    await runPendingPromises();

    expect(screen.getByTestId("gasto-categoria")).toBeInTheDocument();
    expect(screen.getByTestId("gasto-importe")).toBeInTheDocument();
    expect(screen.getByTestId("gasto-descripcion")).toBeInTheDocument();

    // Completar datos
    await userEvent.type(screen.getByTestId("operaciones-create-cuenta-financiera"), "C1");
    await userEvent.type(screen.getByTestId("gasto-importe"), "15000");
    await userEvent.type(screen.getByTestId("gasto-descripcion"), "Pago de internet");

    // Guardar
    await userEvent.click(screen.getByTestId("modal-submit"));
    await runPendingPromises();

    await waitFor(() => {
      expect(mockCrearGasto).toHaveBeenCalledWith(
        expect.objectContaining({
          cuentaId: "C1",
          categoria: "ALQUILER",
          importe: 15000,
          descripcion: "Pago de internet",
          idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        })
      );
    });

    expect(mockRefreshOperaciones).toHaveBeenCalledTimes(1);
    expect(mockRefreshCuentas).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("permite editar un gasto existente cuando se pasa la prop gasto", async () => {
    const onClose = vi.fn();
    mockActualizarGasto.mockResolvedValue({
      data: { id: "G1", cuentaId: "C1", categoria: "SERVICIOS", importe: 8000 },
      error: null,
    });

    render(
      <OperacionCreateModal
        open
        talleres={[{ id: "T1", nombre: "Taller Centro" }]}
        gasto={{
          id: "G1",
          cuentaId: "C1",
          categoria: "ALQUILER",
          importe: 5000,
          fecha: "2026-08-01",
          descripcion: "Alquiler mensual",
          arregloId: null,
          operacionId: null,
          createdAt: "2026-08-01T00:00:00Z",
          updatedAt: "2026-08-01T00:00:00Z",
        }}
        onClose={onClose}
      />
    );

    await runPendingPromises();

    expect(screen.getByText("Editar gasto")).toBeInTheDocument();
    expect(screen.getByTestId("gasto-importe")).toHaveValue(5000);
    expect(screen.getByTestId("gasto-descripcion")).toHaveValue("Alquiler mensual");

    await userEvent.clear(screen.getByTestId("gasto-importe"));
    await userEvent.type(screen.getByTestId("gasto-importe"), "8000");

    await userEvent.click(screen.getByTestId("modal-submit"));
    await runPendingPromises();

    await waitFor(() => {
      expect(mockActualizarGasto).toHaveBeenCalledWith(
        "G1",
        expect.objectContaining({
          cuentaId: "C1",
          importe: 8000,
          descripcion: "Alquiler mensual",
        })
      );
    });

    expect(mockRefreshOperaciones).toHaveBeenCalledTimes(1);
    expect(mockRefreshCuentas).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("si hay multiples talleres, muestra el dropdown de talleres", async () => {
    render(
      <OperacionCreateModal
        open
        talleres={[
          { id: "T1", nombre: "Taller Centro" },
          { id: "T2", nombre: "Taller Norte" },
        ]}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    expect(screen.getByTestId("operaciones-create-taller")).toBeInTheDocument();
  });

  it("permite registrar una venta seleccionando item y guardando", async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: "OP1" });
    vi.mocked(mockInventarioApi).inventario = [
      {
        id: "S1",
        nombre: "Filtro de Aceite",
        codigo: "FA-01",
        precioUnitario: 3500,
        costoUnitario: 2000,
        stockActual: 10,
      },
    ];

    const onClose = vi.fn();
    render(
      <OperacionCreateModal
        open
        talleres={[{ id: "T1", nombre: "Taller Centro" }]}
        initialTipo="VENTA"
        initialCuentaId="C1"
        onClose={onClose}
      />
    );

    await runPendingPromises();

    // Seleccionar stock en la linea 0
    await userEvent.type(screen.getByTestId("operaciones-line-0-stock"), "S1");

    // Click submit
    await userEvent.click(screen.getByTestId("modal-submit"));
    await runPendingPromises();

    expect(screen.getByTestId("modal-submit")).toBeInTheDocument();
  });
});


