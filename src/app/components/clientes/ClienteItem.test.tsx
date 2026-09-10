import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ClienteItem from "./ClienteItem";
import { Cliente, TipoCliente } from "@/model/types";
import { ROUTES } from "@/routing/routes";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockConfirm = vi.fn();
vi.mock("@/app/providers/ModalMessageProvider", () => ({
  useModalMessage: () => ({
    confirm: mockConfirm,
  }),
}));

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
};
vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => mockToast,
}));

const mockDeleteCliente = vi.fn();
vi.mock("@/app/providers/ClientesProvider", () => ({
  useClientes: () => ({
    deleteCliente: mockDeleteCliente,
  }),
}));

const mockGetResumenFinanciero = vi.fn().mockResolvedValue({ data: null, error: null });
vi.mock("@/clients/clientes/clientesClient", () => ({
  clientesClient: {
    getResumenFinanciero: (...args: unknown[]) => mockGetResumenFinanciero(...args),
  },
}));

describe("ClienteItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGetResumenFinanciero.mockResolvedValue({ data: null, error: null });
  });

  const particularCliente: Cliente = {
    id: "cliente-1",
    nombre: "Lucia Gomez",
    tipo_cliente: TipoCliente.PARTICULAR,
    codigo_pais: "54",
    telefono: "3415551001",
    email: "lucia.gomez@test.com",
    direccion: "San Martin 1200",
    vehiculos_count: 1,
    saldo_cuenta: 0,
  };

  const empresaCliente: Cliente = {
    id: "cliente-2",
    nombre: "Autopartes Norte SA",
    tipo_cliente: TipoCliente.EMPRESA,
    codigo_pais: "54",
    telefono: "3415551101",
    email: "contacto@autopartesnorte.test",
    direccion: "Calle Falsa 123",
    cuit: "30-71234567-8",
    vehiculos_count: 5,
    saldo_cuenta: 140000,
  };

  it("renderiza cliente particular con iniciales, datos de contacto, vehículos y estado 'Al día'", () => {
    render(<ClienteItem cliente={particularCliente} />);

    // Iniciales
    expect(screen.getByText("LG")).toBeInTheDocument();
    // Nombre
    expect(screen.getByText("Lucia Gomez")).toBeInTheDocument();
    // Tipo de cliente
    expect(screen.getByText("Particular")).toBeInTheDocument();
    // Contacto
    expect(screen.getByText("+54 3415551001")).toBeInTheDocument();
    expect(screen.getByText("lucia.gomez@test.com")).toBeInTheDocument();
    expect(screen.getByText("San Martin 1200")).toBeInTheDocument();
    // Vehículos
    expect(screen.getByText("1 Vehículo")).toBeInTheDocument();
    // Estado financiero
    expect(screen.getByTestId("cliente-clean-amount")).toHaveTextContent("$0");
    expect(screen.getByTestId("cliente-clean-badge")).toBeInTheDocument();
  });

  it("renderiza cliente empresa con CUIT y saldo con deuda 'A Cobrar'", () => {
    render(<ClienteItem cliente={empresaCliente} />);

    expect(screen.getByText("AS")).toBeInTheDocument();
    expect(screen.getByText("Autopartes Norte SA")).toBeInTheDocument();
    expect(screen.getByText("Empresa")).toBeInTheDocument();
    expect(screen.getByText("CUIT: 30-71234567-8")).toBeInTheDocument();
    expect(screen.getByText("5 Vehículos")).toBeInTheDocument();
    expect(screen.getByTestId("cliente-debt-badge")).toBeInTheDocument();
    expect(screen.getByTestId("cliente-debt-amount")).toHaveTextContent("$140.000");
  });

  it("muestra saldo a favor cuando el saldo consolidado es negativo", () => {
    render(<ClienteItem cliente={{ ...particularCliente, saldo_cuenta: -45000 }} />);

    expect(screen.getByTestId("cliente-credit-amount")).toHaveTextContent("$45.000");
    expect(screen.getByTestId("cliente-credit-badge")).toHaveTextContent("Saldo a favor");
    expect(screen.queryByTestId("cliente-clean-badge")).not.toBeInTheDocument();
  });

  it("muestra placeholders cuando faltan datos (teléfono, email, dirección, vehículos)", () => {
    const incompleteCliente: Cliente = {
      id: "cliente-3",
      nombre: "Sofia Ruiz",
      tipo_cliente: TipoCliente.PARTICULAR,
      telefono: "",
      email: "",
      direccion: "",
      vehiculos_count: 0,
    };

    render(<ClienteItem cliente={incompleteCliente} />);

    expect(screen.getByText("Sin teléfono")).toBeInTheDocument();
    expect(screen.getByText("Sin correo")).toBeInTheDocument();
    expect(screen.getByText("Sin dirección")).toBeInTheDocument();
    expect(screen.getByText("Sin vehículos")).toBeInTheDocument();
  });

  it("navega al detalle del cliente al hacer click en la tarjeta y guarda tipo_cliente en localStorage", () => {
    render(<ClienteItem cliente={particularCliente} />);

    const card = screen.getByTestId("cliente-item");
    fireEvent.click(card);

    expect(localStorage.getItem("tipo_cliente")).toBe("PARTICULAR");
    expect(mockPush).toHaveBeenCalledWith(`${ROUTES.clientes}/${particularCliente.id}`);
  });

  it("abre modal y elimina cliente al hacer click en el botón de borrar sin disparar navegación", async () => {
    mockConfirm.mockResolvedValueOnce(true);
    mockDeleteCliente.mockResolvedValueOnce(undefined);

    render(<ClienteItem cliente={empresaCliente} />);

    const deleteBtn = screen.getByTestId("cliente-delete-btn");
    fireEvent.click(deleteBtn);

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Eliminar cliente",
        message: expect.stringContaining("Autopartes Norte SA"),
      })
    );

    // Wait for async deletion resolution
    await vi.waitFor(() => {
      expect(mockDeleteCliente).toHaveBeenCalledWith(empresaCliente.id, TipoCliente.EMPRESA);
      expect(mockToast.success).toHaveBeenCalledWith(
        "Cliente eliminado",
        expect.stringContaining("Autopartes Norte SA se eliminó correctamente.")
      );
    });
  });

  it("no elimina al cliente si el usuario cancela en el modal", async () => {
    mockConfirm.mockResolvedValueOnce(false);

    render(<ClienteItem cliente={particularCliente} />);

    const deleteBtn = screen.getByRole("button", { name: /eliminar cliente/i });
    fireEvent.click(deleteBtn);

    await vi.waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled();
      expect(mockDeleteCliente).not.toHaveBeenCalled();
      expect(mockToast.success).not.toHaveBeenCalled();
    });
  });

  it("muestra los valores completos mediante atributos title (tooltips en hover)", () => {
    render(<ClienteItem cliente={particularCliente} />);

    expect(screen.getByRole("heading", { level: 3 })).toHaveAttribute("title", "Lucia Gomez");
    expect(screen.getByTitle("Teléfono: +54 3415551001")).toBeInTheDocument();
    expect(screen.getByTitle("Correo: lucia.gomez@test.com")).toBeInTheDocument();
    expect(screen.getByTitle("Dirección: San Martin 1200")).toBeInTheDocument();
    expect(screen.getByTitle("1 Vehículo")).toBeInTheDocument();
    expect(screen.getByTitle("Cuenta corriente al día ($0)")).toBeInTheDocument();
  });

  it("carga el saldo pendiente asincrónicamente vía getResumenFinanciero cuando saldo_cuenta no viene en el cliente", async () => {
    mockGetResumenFinanciero.mockResolvedValueOnce({
      data: {
        saldo_cuenta: 250000,
        saldo_a_facturar: 0,
        total_historico_trabajos: 250000,
        total_historico_cobrado: 0,
        cantidad_arreglos_pendientes_pago: 1,
        cantidad_arreglos_pendientes_factura: 0,
      },
      error: null,
    });

    const clienteSinSaldo: Cliente = {
      id: "cliente-async-1",
      nombre: "Carlos Tevez",
      tipo_cliente: TipoCliente.PARTICULAR,
      telefono: "1122334455",
      email: "carlos@test.com",
      direccion: "Fuerte Apache",
      // saldo_cuenta is intentionally undefined
    };

    render(<ClienteItem cliente={clienteSinSaldo} />);

    expect(mockGetResumenFinanciero).toHaveBeenCalledWith("cliente-async-1");

    await waitFor(() => {
      expect(screen.getByTestId("cliente-debt-amount")).toHaveTextContent("$250.000");
      expect(screen.getByTestId("cliente-debt-badge")).toBeInTheDocument();
    });
  });
});
