import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VehiculoDetailsPage from "./page";
import VehiculosLayout from "../layout";
import { TenantProvider } from "@/app/providers/TenantProvider";
import { ModalMessageProvider } from "@/app/providers/ModalMessageProvider";
import ToastProvider from "@/app/providers/ToastProvider";
import { SheetProvider } from "@/app/providers/SheetProvider";
import { createArreglo, createCliente, createVehiculo } from "@/tests/factories";
import { ROUTES } from "@/routing/routes";
import { TipoCliente } from "@/model/types";

const pushMock = vi.fn();
const getByIdMock = vi.fn();
const getClienteForVehiculoMock = vi.fn();
const getAllVehiculosMock = vi.fn();
const deleteVehiculoMock = vi.fn();
const tenantGetAllMock = vi.fn();
const clientesGetAllMock = vi.fn();
const arreglosCreateMock = vi.fn();
const arreglosGetAllMock = vi.fn();
const shareMock = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "veh-1" }),
  useRouter: () => ({
    push: pushMock,
    back: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/clients/vehiculoClient", () => ({
  vehiculoClient: {
    getAll: (...args: unknown[]) => getAllVehiculosMock(...args),
    getById: (...args: unknown[]) => getByIdMock(...args),
    getClienteForVehiculo: (...args: unknown[]) => getClienteForVehiculoMock(...args),
    delete: (...args: unknown[]) => deleteVehiculoMock(...args),
    create: vi.fn(),
    update: vi.fn(),
    reassignOwner: vi.fn(),
  },
}));

vi.mock("@/clients/tenantClient", () => ({
  tenantClient: {
    getAll: (...args: unknown[]) => tenantGetAllMock(...args),
  },
}));

vi.mock("@/clients/clientes/clientesClient", () => ({
  clientesClient: {
    getAll: (...args: unknown[]) => clientesGetAllMock(...args),
  },
}));

vi.mock("@/clients/arreglosClient", () => ({
  arreglosClient: {
    getAll: (...args: unknown[]) => arreglosGetAllMock(...args),
    getById: vi.fn(),
    create: (...args: unknown[]) => arreglosCreateMock(...args),
    update: vi.fn(),
    delete: vi.fn(),
    createDetalle: vi.fn(),
    updateDetalle: vi.fn(),
    deleteDetalle: vi.fn(),
    upsertRepuestoLinea: vi.fn(),
    deleteRepuestoLinea: vi.fn(),
  },
}));

vi.mock("@/app/hooks/useWhatsAppMessage", () => ({
  useWhatsAppMessage: () => ({
    share: shareMock,
  }),
}));

function TestShell() {
  return (
    <TenantProvider>
      <SheetProvider>
        <ModalMessageProvider>
          <ToastProvider>
            <VehiculosLayout>
              <VehiculoDetailsPage />
            </VehiculosLayout>
          </ToastProvider>
        </ModalMessageProvider>
      </SheetProvider>
    </TenantProvider>
  );
}

function mockSuccessfulFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/arreglos/formularios")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [], error: null }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ data: [], error: null }),
      } as Response;
    })
  );
}

function setupDefaultData() {
  const vehiculo = createVehiculo({
    id: "veh-1",
    patente: "AA123BB",
    marca: "Toyota",
    modelo: "Corolla",
  });
  const cliente = createCliente({
    id: "cli-1",
    nombre: "Cliente Test",
    tipo_cliente: TipoCliente.EMPRESA,
  });
  const arreglos = [
    createArreglo({
      id: "arr-1",
      descripcion: "Cambio de aceite",
      fecha: "2026-03-01",
      vehiculo,
    }),
    createArreglo({
      id: "arr-2",
      descripcion: "Frenos delanteros",
      fecha: "2026-03-10",
      vehiculo,
    }),
  ];

  tenantGetAllMock.mockResolvedValue({
    data: [{ id: "t1", nombre: "Taller 1", ubicacion: "X" }],
    error: null,
  });
  clientesGetAllMock.mockResolvedValue({ data: [], error: null });
  getAllVehiculosMock.mockResolvedValue({ data: [], error: null });
  getByIdMock.mockResolvedValue({ data: vehiculo, arreglos, error: null });
  getClienteForVehiculoMock.mockResolvedValue({ data: cliente, error: null });
  arreglosGetAllMock.mockResolvedValue({
    data: [],
    page: { hasMore: false },
    error: null,
  });
  arreglosCreateMock.mockResolvedValue(
    {
      data: createArreglo({
        id: "arr-new",
        vehiculo,
        fecha: "2026-03-19",
      }),
      error: null,
    }
  );
  deleteVehiculoMock.mockResolvedValue({ error: null });

  return { vehiculo, cliente, arreglos };
}

beforeAll(() => {
  Object.defineProperty(window, "scrollTo", {
    value: vi.fn(),
    writable: true,
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem("tenant_name", "Taller Demo");
  mockSuccessfulFetch();
});

describe("VehiculoDetailsPage integration", () => {
  it("permite crear un arreglo desde el detalle usando el layout real", async () => {
    setupDefaultData();
    const user = userEvent.setup();

    render(<TestShell />);

    expect(await screen.findByText("AA123BB - Toyota Corolla")).toBeInTheDocument();

    await user.click(screen.getByTestId("arreglos-open-create"));

    expect(await screen.findByTestId("modal-title")).toHaveTextContent("Crear arreglo");

    const fechaInput = document.querySelector('input[type="date"]') as HTMLInputElement | null;
    expect(fechaInput).not.toBeNull();
    fireEvent.change(fechaInput!, { target: { value: "2026-03-19" } });

    await user.click(screen.getByTestId("modal-submit"));

    await waitFor(() => {
      expect(arreglosCreateMock).toHaveBeenCalledTimes(1);
    });
    expect(arreglosCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        vehiculo_id: "veh-1",
        taller_id: "t1",
        fecha: "2026-03-19",
      })
    );

    await waitFor(() => {
      expect(getByIdMock).toHaveBeenCalledTimes(2);
    });
    expect(getClienteForVehiculoMock).toHaveBeenCalledTimes(2);
  });

  it("permite navegar al detalle del arreglo y filtrar con la UI real", async () => {
    setupDefaultData();
    const user = userEvent.setup();

    render(<TestShell />);

    expect(await screen.findByTestId("arreglo-item-arr-1")).toBeInTheDocument();
    expect(screen.getByTestId("arreglo-item-arr-2")).toBeInTheDocument();

    await user.type(screen.getByTestId("arreglos-search"), "frenos");

    await waitFor(() => {
      expect(screen.queryByTestId("arreglo-item-arr-1")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("arreglo-item-arr-2")).toBeInTheDocument();

    await user.click(screen.getByText("Frenos delanteros"));

    expect(pushMock).toHaveBeenCalledWith("/arreglos/arr-2");
  });

  it("permite navegar al propietario con la UI real", async () => {
    setupDefaultData();
    const user = userEvent.setup();

    render(<TestShell />);

    await user.click(await screen.findByText("Cliente Test"));

    expect(localStorage.getItem("tipo_cliente")).toBe(TipoCliente.EMPRESA);
    expect(pushMock).toHaveBeenCalledWith(`${ROUTES.clientes}/cli-1`);
  });
});
