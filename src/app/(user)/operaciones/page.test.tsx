import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { runPendingPromises } from "@/tests/testUtils";
import type { TipoOperacion } from "@/model/types";
import { OperacionesProvider } from "@/app/providers/OperacionesProvider";

const talleresMock: { id: string; nombre: string }[] = [];
const getAllMock = vi.fn();
const getStatsMock = vi.fn();

vi.mock("@/app/providers/InventarioProvider", () => ({
  useInventario: () => ({
    getStockById: vi.fn().mockResolvedValue(null),
    isLoading: false,
    inventario: [],
  }),
}));

vi.mock("@/app/providers/ProductosProvider", () => ({
  useProductos: () => ({
    productos: [],
    isLoading: false,
    loadProductos: vi.fn(),
    getProductoById: vi.fn(),
    updateProducto: vi.fn(),
    removeProducto: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/app/providers/SheetProvider", () => ({
  useSheet: () => ({
    openSheet: vi.fn(),
  }),
}));

vi.mock("@/app/providers/ModalMessageProvider", () => ({
  useModalMessage: () => ({
    confirm: vi.fn().mockResolvedValue(true),
  }),
}));

vi.mock("@/app/components/ui/ScreenHeader", () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock("@/clients/operacionesClient", () => ({
	OPERACIONES_PAGE_SIZE: 50,
  operacionesClient: {
    getAll: (...args: unknown[]) => getAllMock(...args),
    getStats: (...args: unknown[]) => getStatsMock(...args),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/app/providers/TenantProvider", () => ({
  useTenant: () => ({
    talleres: talleresMock,
  }),
}));

import OperacionesPage, { formatOperacionCardAmount } from "./page";
import ToastProvider from "@/app/providers/ToastProvider";

describe("OperacionesPage", () => {
  beforeEach(() => {
    getAllMock.mockReset();
    getAllMock.mockResolvedValue({ data: [], error: null });
    getStatsMock.mockReset();
    getStatsMock.mockResolvedValue({ data: null, error: null });
    vi.useFakeTimers();
    vi.spyOn(performance, "now").mockReturnValue(0);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(1500);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("debe cargar todas las operaciones al cargar la página", async () => {
    render(
      <OperacionesProvider>
        <ToastProvider>
          <OperacionesPage />
        </ToastProvider>
      </OperacionesProvider>
    );
    await runPendingPromises();

    expect(getAllMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
      expect.objectContaining({ page: 1 })
    );
  });

  it("Al cargar un tipo de operación, debe filtrar las operaciones por ese tipo", async () => {
    render(
      <OperacionesProvider>
        <ToastProvider>
          <OperacionesPage />
        </ToastProvider>
      </OperacionesProvider>
    );
    await runPendingPromises();

    const tipoSeleccionado: TipoOperacion = "COMPRA";
    fireEvent.click(screen.getByTestId("operaciones-chip-COMPRA"));
    await runPendingPromises();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    await runPendingPromises();

    expect(getAllMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        from: expect.any(String),
        to: expect.any(String),
        tipo: [tipoSeleccionado],
      }),
      expect.objectContaining({ page: 1 })
    );
  });

  it("ofrece un filtro específico para los cobros de arreglos", async () => {
    render(
      <OperacionesProvider>
        <ToastProvider>
          <OperacionesPage />
        </ToastProvider>
      </OperacionesProvider>
    );
    await runPendingPromises();

    expect(screen.getByTestId("operaciones-chip-COBRO_ARREGLO")).toHaveTextContent("Cobro de arreglo");
  });

  it("agrupa las estadísticas en ingresos, egresos y resultado", async () => {
    render(
      <OperacionesProvider>
        <ToastProvider>
          <OperacionesPage />
        </ToastProvider>
      </OperacionesProvider>
    );
    await runPendingPromises();

    expect(screen.getByLabelText("Resumen de ingresos")).toHaveTextContent("Ventas");
    expect(screen.getByLabelText("Resumen de egresos")).toHaveTextContent("Compras");
    expect(screen.getByLabelText("Resultado del período")).toBeInTheDocument();
  });
  it("formatea los fotogramas animados de las cards sin decimales", () => {
    expect(formatOperacionCardAmount(875.625)).toBe("$876");
    expect(formatOperacionCardAmount(1234567.25)).toBe("$1.234.567");
  });
});

