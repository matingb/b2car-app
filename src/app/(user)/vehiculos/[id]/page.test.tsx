import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VehiculoDetailsPage from "./page";
import VehiculosLayout from "../layout";
import { TenantProvider } from "@/app/providers/TenantProvider";
import { ModalMessageProvider } from "@/app/providers/ModalMessageProvider";
import ToastProvider from "@/app/providers/ToastProvider";
import { SheetProvider } from "@/app/providers/SheetProvider";
import { CategoriasArregloProvider } from "@/app/providers/CategoriasArregloProvider";
import { EmpleadosProvider } from "@/app/providers/EmpleadosProvider";
import { BreakpointProvider } from "@/app/providers/BreakpointProvider";
import { createArreglo, createArregloDetalleData, createCliente, createVehiculo } from "@/tests/factories";
import { ROUTES } from "@/routing/routes";
import { TipoCliente, type Arreglo } from "@/model/types";
import { Permission, type PermissionValue } from "@/lib/permissions";

const pushMock = vi.fn();
let cobroPagadoMock: Partial<Arreglo> = {};
const getByIdMock = vi.fn();
const getClienteForVehiculoMock = vi.fn();
const getAllVehiculosMock = vi.fn();
const deleteVehiculoMock = vi.fn();
const tenantGetAllMock = vi.fn();
const clientesGetAllMock = vi.fn();
const arreglosCreateMock = vi.fn();
const arreglosGetAllMock = vi.fn();
const arreglosGetByIdMock = vi.fn();
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
    getById: (...args: unknown[]) => arreglosGetByIdMock(...args),
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

// El modal real tiene su propio test; acá solo simula que el cobro se registró.
// Como el Modal real, frena la propagación para no disparar el click de la card.
vi.mock("@/app/components/arreglos/CobroArregloModal", () => ({
  default: ({
    open,
    arregloId,
    onPaid,
  }: {
    open: boolean;
    arregloId: string;
    onPaid?: (arreglo: Arreglo) => void;
  }) =>
    open ? (
      <button
        type="button"
        data-testid="simular-cobro"
        onClick={(e) => {
          e.stopPropagation();
          onPaid?.({ id: arregloId, ...cobroPagadoMock } as Arreglo);
        }}
      >
        Simular cobro
      </button>
    ) : null,
}));

import { CuentasFinancierasProvider } from "@/app/providers/CuentasFinancierasProvider";

function TestShell({ initialPermissions }: { initialPermissions?: PermissionValue[] }) {
  return (
    <TenantProvider initialPermissions={initialPermissions}>
      <CuentasFinancierasProvider>
        <BreakpointProvider>
          <CategoriasArregloProvider>
            <EmpleadosProvider>
              <SheetProvider>
                <ModalMessageProvider>
                  <ToastProvider>
                    <VehiculosLayout>
                      <VehiculoDetailsPage />
                    </VehiculosLayout>
                  </ToastProvider>
                </ModalMessageProvider>
              </SheetProvider>
            </EmpleadosProvider>
          </CategoriasArregloProvider>
        </BreakpointProvider>
      </CuentasFinancierasProvider>
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

function setupDefaultData(vehiculoOverrides: Partial<ReturnType<typeof createVehiculo>> = {}) {
  const vehiculo = createVehiculo({
    id: "veh-1",
    patente: "AA123BB",
    marca: "Toyota",
    modelo: "Corolla",
    ...vehiculoOverrides,
  });
  const cliente = createCliente({
    id: "cli-1",
    nombre: "Cliente Test",
    tipo_cliente: TipoCliente.EMPRESA,
    codigo_pais: "+54",
    telefono: "91123456789",
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
  it("muestra color y numero de motor cuando el vehiculo los tiene configurados", async () => {
    setupDefaultData({ color: "Azul", numero_motor: "MTR123" });

    render(<TestShell />);

    expect(await screen.findByText("Color")).toBeInTheDocument();
    expect(screen.getByText("Azul")).toBeInTheDocument();
    expect(screen.getByText("N° motor")).toBeInTheDocument();
    expect(screen.getByText("MTR123")).toBeInTheDocument();
  });

  it("oculta color y numero de motor cuando no estan configurados", async () => {
    setupDefaultData({ color: "  ", numero_motor: "" });

    render(<TestShell />);

    await screen.findAllByText("AA123BB - Toyota Corolla");
    expect(screen.queryByText("Color")).not.toBeInTheDocument();
    expect(screen.queryByText("N° motor")).not.toBeInTheDocument();
  });

  it("permite crear un arreglo desde el detalle usando el layout real", async () => {
    setupDefaultData();
    const user = userEvent.setup();

    render(<TestShell />);

    await screen.findAllByText("AA123BB - Toyota Corolla");

    await user.click(screen.getByTestId("arreglos-open-create"));
    expect(await screen.findByTestId("modal-title")).toHaveTextContent("Crear arreglo");
    expect(screen.getByTestId("arreglo-fecha")).toBeInTheDocument();

    await user.click(screen.getByTestId("modal-submit"));

    await waitFor(() => {
      expect(arreglosCreateMock).toHaveBeenCalledTimes(1);
    });
    expect(arreglosCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        vehiculo_id: "veh-1",
        taller_id: "t1",
        fecha: expect.any(String),
      })
    );

    expect(await screen.findByText("Compartir arreglo")).toBeInTheDocument();
  });

  it("abre el modal de WhatsApp al elegir compartir el arreglo recién creado", async () => {
    setupDefaultData();
    const vehiculo = createVehiculo({
      id: "veh-1",
      patente: "AA123BB",
      marca: "Toyota",
      modelo: "Corolla",
    });
    const detalle = createArregloDetalleData({
      arreglo: createArreglo({ id: "arr-new", vehiculo, precio_final: 0 }),
      detalles: [],
      asignaciones: [],
    });
    arreglosGetByIdMock.mockResolvedValue({ data: detalle, error: null });
    const user = userEvent.setup();

    render(<TestShell />);

    await user.click(await screen.findByTestId("arreglos-open-create"));
    await screen.findByTestId("modal-title");
    await user.click(screen.getByTestId("modal-submit"));
    await screen.findByText("Compartir arreglo");

    await user.click(screen.getByRole("button", { name: /^Compartir$/ }));

    expect(await screen.findByRole("button", { name: "Abrir chat de WhatsApp" })).toBeInTheDocument();
    expect(arreglosGetByIdMock).toHaveBeenCalledTimes(1);
    expect(getClienteForVehiculoMock).toHaveBeenCalledTimes(2);
  });

  it("recarga después de elegir Ahora no y permite abrir un formulario nuevo", async () => {
    setupDefaultData();
    const user = userEvent.setup();

    render(<TestShell />);

    await user.click(await screen.findByTestId("arreglos-open-create"));
    await screen.findByTestId("modal-title");
    await user.click(screen.getByTestId("modal-submit"));
    await screen.findByText("Compartir arreglo");

    expect(getByIdMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Ahora no" }));

    await waitFor(() => expect(getByIdMock).toHaveBeenCalledTimes(2));
    expect(arreglosCreateMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Abrir chat de WhatsApp" })).not.toBeInTheDocument();

    await user.click(await screen.findByTestId("arreglos-open-create"));
    expect(await screen.findByTestId("modal-title")).toHaveTextContent("Crear arreglo");
  });

  it("finaliza y recarga si no puede cargar el detalle para compartir", async () => {
    setupDefaultData();
    arreglosGetByIdMock.mockResolvedValue({ data: null, error: null });
    const user = userEvent.setup();

    render(<TestShell />);

    await user.click(await screen.findByTestId("arreglos-open-create"));
    await screen.findByTestId("modal-title");
    await user.click(screen.getByTestId("modal-submit"));
    await screen.findByText("Compartir arreglo");
    await user.click(screen.getByRole("button", { name: /^Compartir$/ }));

    await waitFor(() => expect(getByIdMock).toHaveBeenCalledTimes(2));
    expect(arreglosGetByIdMock).toHaveBeenCalledTimes(1);
    expect(arreglosCreateMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Abrir chat de WhatsApp" })).not.toBeInTheDocument();
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

  it("actualiza el badge de pago del listado al registrar un cobro, sin recargar la página", async () => {
    const { vehiculo } = setupDefaultData();
    getByIdMock.mockResolvedValue({
      data: vehiculo,
      arreglos: [
        createArreglo({
          id: "arr-1",
          descripcion: "Cambio de aceite",
          vehiculo,
          estado: "TERMINADO",
          precio_final: 15000,
          esta_pago: false,
          total_cobrado: 0,
          saldo_pendiente: 15000,
        }),
      ],
      error: null,
    });
    cobroPagadoMock = { esta_pago: true, total_cobrado: 15000, saldo_pendiente: 0 };
    const user = userEvent.setup();

    render(<TestShell initialPermissions={[Permission.ArreglosCobrosRegister]} />);

    const item = await screen.findByTestId("arreglo-item-arr-1");
    expect(within(item).getByTestId("arreglo-pago-badge")).toHaveTextContent("Pago pendiente");

    await user.click(within(item).getByTestId("arreglo-pago-badge"));
    await user.click(await screen.findByTestId("simular-cobro"));

    await waitFor(() => {
      expect(within(item).getByTestId("arreglo-pago-badge")).toHaveTextContent("Pagado");
    });
    expect(getByIdMock).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("permite navegar al propietario con la UI real", async () => {
    setupDefaultData();
    const user = userEvent.setup();

    render(<TestShell />);

    await user.click(await screen.findByText("Cliente Test"));

    expect(localStorage.getItem("tipo_cliente")).toBe(TipoCliente.EMPRESA);
    expect(pushMock).toHaveBeenCalledWith(`${ROUTES.clientes}/cli-1`);
  });

  it("muestra la card de información del propietario y abre el modal de reasignar", async () => {
    setupDefaultData();
    const user = userEvent.setup();

    render(<TestShell />);

    expect(await screen.findByText("Cliente Test")).toBeInTheDocument();
    expect(screen.getByText("CT")).toBeInTheDocument();
    expect(screen.getByText("Empresa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "WhatsApp" })).toBeInTheDocument();

    const reassignButton = screen.getByTestId("propietario-reassign");
    expect(reassignButton).toHaveTextContent("Reasignar");

    await user.click(reassignButton);
    expect(await screen.findByText("Reasignar propietario")).toBeInTheDocument();
  });
});
