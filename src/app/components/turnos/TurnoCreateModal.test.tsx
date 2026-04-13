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

  it("habilita el botón Guardar cuando el usuario selecciona cliente y vehículo", async () => {
    mockCreateTurno.mockResolvedValueOnce({
      id: "T-1",
      fecha: "2026-03-01",
      hora: "09:00",
      duracion: null,
      cliente_id: "C-1",
      vehiculo_id: "V-1",
      tipo: "Mecánica",
    });

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

    // seleccionar cliente
    await userEvent.click(screen.getByPlaceholderText("Buscar cliente..."));
    await userEvent.click(screen.getByText("Juan"));

    // seleccionar vehículo (ahora debería estar habilitado)
    await userEvent.click(screen.getByPlaceholderText("Buscar o crear vehículo..."));
    await userEvent.click(screen.getByText("REW164"));

    await waitFor(() => expect(submit).not.toBeDisabled());
  });

  it("auto-selecciona el vehículo cuando el cliente tiene uno solo", async () => {
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

    await userEvent.click(screen.getByPlaceholderText("Buscar cliente..."));
    await userEvent.click(screen.getByText("Juan"));

    // sin seleccionar vehículo manualmente, el botón debe habilitarse
    await waitFor(() => expect(submit).not.toBeDisabled());

    const vehiculoInput = screen.getByPlaceholderText("Buscar o crear vehículo...");
    expect(vehiculoInput).toHaveValue("REW164");
  });

  it("genera el mensaje de compartir con nombre de cliente, vehículo y hora sin segundos", async () => {
    mockCreateTurno.mockResolvedValueOnce(
      createTurnoDto({ cliente_id: "C-1", vehiculo_id: "V-1", fecha: "2026-03-01", hora: "09:00" })
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

    await userEvent.click(screen.getByPlaceholderText("Buscar cliente..."));
    await userEvent.click(screen.getByText("Juan"));
    await userEvent.click(screen.getByPlaceholderText("Buscar o crear vehículo..."));
    await userEvent.click(screen.getByText("REW164"));

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

