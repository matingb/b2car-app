import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { runPendingPromises } from "@/tests/testUtils";
import type { TipoOperacion } from "@/model/types";
import { OperacionesProvider } from "@/app/providers/OperacionesProvider";

const talleresMock: { id: string; nombre: string }[] = [];
const getAllMock = vi.fn();

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

vi.mock("@/app/components/ui/ScreenHeader", () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock("@/clients/operacionesClient", () => ({
  operacionesClient: {
    getAll: (...args: unknown[]) => getAllMock(...args),
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

import OperacionesPage from "./page";

describe("OperacionesPage", () => {
  beforeEach(() => {
    getAllMock.mockReset();
    getAllMock.mockResolvedValue({ data: [], error: null });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debe cargar todas las operaciones al cargar la página", async () => {
    render(
      <OperacionesProvider>
        <OperacionesPage />
      </OperacionesProvider>
    );
    await runPendingPromises();

    expect(getAllMock).toHaveBeenCalledTimes(1);
  });

  it("Al cargar un tipo de operación, debe filtrar las operaciones por ese tipo", async () => {
    render(
      <OperacionesProvider>
        <OperacionesPage />
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

    expect(getAllMock).toHaveBeenCalledWith({ tipo: [tipoSeleccionado] });
  });
});

