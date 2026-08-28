import { describe, expect, it, beforeAll, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Arreglo } from "@/model/types";
import { createArreglo, createVehiculo } from "@/tests/factories";
import { runPendingPromises } from "@/tests/testUtils";

let arreglosMock: Arreglo[] = [];

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/app/providers/ArreglosProvider", () => ({
  useArreglos: () => ({
    arreglos: arreglosMock,
    loading: false,
  }),
}));

vi.mock("@/app/providers/SheetProvider", () => ({
  useSheet: () => ({
    openSheet: vi.fn(),
  }),
}));

vi.mock("@/app/providers/TenantProvider", () => ({
  useTenant: () => ({
    talleres: [{ id: "t1", nombre: "Taller 1", ubicacion: "X" }],
    tallerSeleccionadoId: "t1",
    setTallerSeleccionadoId: vi.fn(),
  }),
}));

vi.mock("@/app/components/arreglos/ArregloModal", () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock("@/app/providers/VehiculosProvider", () => ({
  useVehiculos: () => ({
    vehiculos: [],
    fetchAll: vi.fn(),
  }),
}));

vi.mock("@/app/providers/ModalMessageProvider", () => ({
  useModalMessage: () => ({
    confirm: vi.fn(),
  }),
}));

vi.mock("@/app/providers/CuentasFinancierasProvider", () => ({
  useCuentasFinancieras: () => ({
    cuentas: [],
    cuentasActivas: [],
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

vi.mock("@/app/providers/BreakpointProvider", () => ({
  useBreakpoint: () => "lg",
}));

vi.mock("@/app/providers/EmpleadosProvider", () => ({
  useEmpleados: () => ({
    empleados: [],
  }),
}));

vi.mock("@/app/providers/CategoriasArregloProvider", () => ({
  useCategoriasArreglo: () => ({
    categorias: [],
  }),
}));

import ArreglosPage from "./page";

async function aplicarFiltros(params: {
  patente: string;
  fechaDesde: string;
  fechaHasta: string;
  estadoPago?: string;
}) {
  await userEvent.click(screen.getByTestId("arreglos-open-filters"));
  expect(screen.getByTestId("modal-overlay")).toBeInTheDocument();

  await userEvent.clear(screen.getByTestId("arreglos-filter-patente"));
  if (params.patente) {
    await userEvent.type(screen.getByTestId("arreglos-filter-patente"), params.patente);
  }

  fireEvent.change(screen.getByTestId("arreglos-filter-fecha-desde"), {
    target: { value: params.fechaDesde },
  });
  fireEvent.change(screen.getByTestId("arreglos-filter-fecha-hasta"), {
    target: { value: params.fechaHasta },
  });

  if (params.estadoPago) {
    await userEvent.click(screen.getByTestId("arreglos-filter-estado-pago"));
    await userEvent.click(await screen.findByText(params.estadoPago));
  }

  await userEvent.click(screen.getByTestId("modal-submit"));
  await runPendingPromises();
  expect(screen.queryByTestId("modal-overlay")).not.toBeInTheDocument();
}

beforeAll(() => {
  Object.defineProperty(window, "scrollTo", {
    value: vi.fn(),
    writable: true,
  });
});

describe("ArreglosPage", () => {
  it("permite buscar por texto y aplicar filtros desde el modal", async () => {
    arreglosMock = [
      createArreglo({
        id: "1",
        descripcion: "Cambio de aceite",

        fecha: "2025-01-10",
        vehiculo: createVehiculo({ patente: "AAA111" }),
      }),
      createArreglo({
        id: "2",
        descripcion: "Reparación de frenos",

        fecha: "2025-02-10",
        vehiculo: createVehiculo({ patente: "BBB222" }),
      }),
      createArreglo({
        id: "3",
        descripcion: "Pintura completa",

        fecha: "2025-01-15",
        vehiculo: createVehiculo({ patente: "CCC333" }),
      }),
    ];

    const user = userEvent.setup();
    render(<ArreglosPage />);

    expect(screen.getByTestId("arreglo-item-1")).toBeInTheDocument();
    expect(screen.getByTestId("arreglo-item-2")).toBeInTheDocument();
    expect(screen.getByTestId("arreglo-item-3")).toBeInTheDocument();

    const searchInput = screen.getByTestId("arreglos-search");
    await user.type(searchInput, "frenos");

    await runPendingPromises();
    expect(screen.queryByTestId("arreglo-item-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("arreglo-item-2")).toBeInTheDocument();
    expect(screen.queryByTestId("arreglo-item-3")).not.toBeInTheDocument();

    await userEvent.clear(searchInput);
    await aplicarFiltros({
      patente: "CCC",
      fechaDesde: "2025-01-01",
      fechaHasta: "2025-01-31",
    });

    await runPendingPromises();
    expect(screen.queryByTestId("arreglo-item-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("arreglo-item-2")).not.toBeInTheDocument();
    expect(screen.getByTestId("arreglo-item-3")).toBeInTheDocument();

    expect(screen.getByTestId("arreglos-active-filters")).toBeInTheDocument();
    await user.click(screen.getByTestId("arreglos-clear-filters"));

    await runPendingPromises();
    expect(screen.getByTestId("arreglo-item-1")).toBeInTheDocument();
    expect(screen.getByTestId("arreglo-item-2")).toBeInTheDocument();
    expect(screen.getByTestId("arreglo-item-3")).toBeInTheDocument();
  });

  it("ofrece el selector de estado de pago junto al estado y filtra los parciales", async () => {
    arreglosMock = [
      createArreglo({ id: "pendiente", esta_pago: false, total_cobrado: 0 }),
      createArreglo({ id: "parcial", esta_pago: false, total_cobrado: 500 }),
      createArreglo({ id: "pagado", esta_pago: true, total_cobrado: 1000 }),
    ];

    render(<ArreglosPage />);

    await aplicarFiltros({
      patente: "",
      fechaDesde: "",
      fechaHasta: "",
      estadoPago: "Parcial",
    });

    expect(screen.queryByTestId("arreglo-item-pendiente")).not.toBeInTheDocument();
    expect(screen.getByTestId("arreglo-item-parcial")).toBeInTheDocument();
    expect(screen.queryByTestId("arreglo-item-pagado")).not.toBeInTheDocument();
    expect(screen.getByText("Pago: parcial")).toBeInTheDocument();
  });
});


