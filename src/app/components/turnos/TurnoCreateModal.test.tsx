import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TurnoCreateModal from "./TurnoCreateModal";
import { createCliente, createTurnoDto } from "@/tests/factories";

const mockCreateTurno = vi.fn();
const mockUpdateTurno = vi.fn();
vi.mock("@/app/providers/TurnosProvider", () => ({
  useTurnos: () => ({
    create: mockCreateTurno,
    update: mockUpdateTurno,
  }),
}));

vi.mock("@/app/providers/TenantProvider", () => ({
  useTenant: () => ({
    talleres: [{ id: "t1", nombre: "Taller Central", ubicacion: "Calle 123" }],
    tallerSeleccionadoId: "t1",
    setTallerSeleccionadoId: vi.fn(),
  }),
}));

const mockCreateParticular = vi.fn();
const mockCreateEmpresa = vi.fn();
const mockGetClienteById = vi.fn();
vi.mock("@/app/providers/ClientesProvider", () => ({
  useClientes: () => ({
    clientes: [
      {
        id: "C-1",
        nombre: "Juan",
        tipo_cliente: "particular",
        telefono: "11",
        email: "a@a.com",
        direccion: "x",
      },
    ],
    createParticular: mockCreateParticular,
    createEmpresa: mockCreateEmpresa,
    getClienteById: mockGetClienteById,
  }),
}));

const mockCreateVehiculo = vi.fn();
vi.mock("@/app/providers/VehiculosProvider", () => ({
  useVehiculos: () => ({
    vehiculos: [
      {
        id: "V-1",
        cliente_id: "C-1",
        nombre_cliente: "Juan",
        patente: "REW164",
        marca: "",
        modelo: "",
        fecha_patente: "",
        numero_chasis: "",
        nro_interno: null,
      },
    ],
    create: mockCreateVehiculo,
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

const mockShare = vi.fn();
vi.mock("@/app/hooks/useWhatsAppMessage", () => ({
  useWhatsAppMessage: () => ({
    share: mockShare,
  }),
}));

const mockConfirm = vi.fn(async () => false);
vi.mock("@/app/providers/ModalMessageProvider", () => ({
  useModalMessage: () => ({
    confirm: mockConfirm,
  }),
}));

describe("TurnoCreateModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("habilita el botón Guardar cuando el usuario ingresa un título", async () => {
    render(
      <TurnoCreateModal
        open
        onClose={vi.fn()}
        defaultFecha={new Date(2026, 2, 1)}
        defaultHora="09:00"
      />
    );

    const submit = screen.getByTestId("modal-submit");
    expect(submit).toBeDisabled();

    // ingresar título directamente
    const tituloInput = screen.getByPlaceholderText(/Ej: Service/i);
    await userEvent.type(tituloInput, "Revisión general de frenos");

    await waitFor(() => expect(submit).not.toBeDisabled());
  });

  it("auto-selecciona el vehículo y sugiere título cuando se elige un cliente con un solo vehículo", async () => {
    render(
      <TurnoCreateModal
        open
        onClose={vi.fn()}
        defaultFecha={new Date(2026, 2, 1)}
        defaultHora="09:00"
      />
    );

    const submit = screen.getByTestId("modal-submit");
    expect(submit).toBeDisabled();

    await userEvent.click(screen.getByPlaceholderText("Buscar cliente"));
    await userEvent.click(screen.getByText("Juan"));

    // sin seleccionar vehículo manualmente, el vehículo se autoselecciona y el título se autocompleta
    await waitFor(() => expect(submit).not.toBeDisabled());

    const vehiculoInput = screen.getByPlaceholderText("Buscar o crear vehículo...");
    expect(vehiculoInput).toHaveValue("REW164");

    const tituloInput = screen.getByPlaceholderText(/Ej: Service/i);
    expect(tituloInput).toHaveValue("Mecánica - REW164 - Juan");
  });

  it("genera el mensaje de compartir con nombre de cliente, vehículo y hora sin segundos", async () => {
    mockCreateTurno.mockResolvedValueOnce(
      createTurnoDto({ titulo: "Service", cliente_id: "C-1", vehiculo_id: "V-1", fecha: "2026-03-01", hora: "09:00" })
    );
    mockGetClienteById.mockResolvedValueOnce(
      createCliente({ id: "C-1", nombre: "Juan", telefono: "1199999999" })
    );
    mockConfirm.mockResolvedValueOnce(true);

    render(
      <TurnoCreateModal
        open
        onClose={vi.fn()}
        defaultFecha={new Date(2026, 2, 1)}
        defaultHora="09:00"
      />
    );

    await userEvent.click(screen.getByPlaceholderText("Buscar cliente"));
    await userEvent.click(screen.getByText("Juan"));

    const submit = screen.getByTestId("modal-submit");
    await waitFor(() => expect(submit).not.toBeDisabled());
    await userEvent.click(submit);

    await waitFor(() => expect(mockShare).toHaveBeenCalled());

    const [mensaje] = mockShare.mock.calls[0] as [string, string];
    expect(mensaje).toContain("Juan");
    expect(mensaje).toContain("REW164");
    expect(mensaje).toContain("2026-03-01");
    expect(mensaje).toContain("Hora: 09:00 hs");
  });
});
