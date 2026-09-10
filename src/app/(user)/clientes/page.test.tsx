import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ClientesPage from "./page";
import { Cliente, TipoCliente } from "@/model/types";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/app/providers/ModalMessageProvider", () => ({
  useModalMessage: () => ({ confirm: vi.fn() }),
}));

vi.mock("@/app/providers/SheetProvider", () => ({
  useSheet: () => ({
    openSheet: vi.fn(),
  }),
}));

const mockClientes: Cliente[] = [
  {
    id: "particular-1",
    nombre: "Juan Perez",
    tipo_cliente: TipoCliente.PARTICULAR,
    telefono: "111",
    email: "juan@test.com",
    direccion: "Calle 1",
    saldo_cuenta: 0,
  },
  {
    id: "particular-2",
    nombre: "Maria Deuda",
    tipo_cliente: TipoCliente.PARTICULAR,
    telefono: "222",
    email: "maria@test.com",
    direccion: "Calle 2",
    saldo_cuenta: 15000,
  },
  {
    id: "empresa-1",
    nombre: "Taller Hermanos SA",
    tipo_cliente: TipoCliente.EMPRESA,
    cuit: "30-11111111-1",
    telefono: "333",
    email: "taller@test.com",
    direccion: "Calle 3",
    saldo_cuenta: 0,
  },
  {
    id: "empresa-2",
    nombre: "Transportes Sur SRL",
    tipo_cliente: TipoCliente.EMPRESA,
    cuit: "30-22222222-2",
    telefono: "444",
    email: "sur@test.com",
    direccion: "Calle 4",
    saldo_cuenta: 50000,
  },
  {
    id: "empresa-3",
    nombre: "Logística con Crédito SA",
    tipo_cliente: TipoCliente.EMPRESA,
    cuit: "30-33333333-3",
    telefono: "555",
    email: "credito@test.com",
    direccion: "Calle 5",
    saldo_cuenta: -20000,
  },
];

vi.mock("@/app/providers/ClientesProvider", () => ({
  useClientes: () => ({
    clientes: mockClientes,
    loading: false,
    createParticular: vi.fn(),
    createEmpresa: vi.fn(),
    deleteCliente: vi.fn(),
  }),
}));

describe("ClientesPage Filtros", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza todos los clientes por defecto", () => {
    render(<ClientesPage />);

    expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    expect(screen.getByText("Maria Deuda")).toBeInTheDocument();
    expect(screen.getByText("Taller Hermanos SA")).toBeInTheDocument();
    expect(screen.getByText("Transportes Sur SRL")).toBeInTheDocument();
    expect(screen.getByText("Logística con Crédito SA")).toBeInTheDocument();
    expect(screen.getByTestId("clientes-open-filters")).toBeInTheDocument();
  });

  it("filtra por particulares al presionar el chip 'Particulares'", () => {
    render(<ClientesPage />);

    fireEvent.click(screen.getByTestId("clientes-chip-particular"));

    expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    expect(screen.getByText("Maria Deuda")).toBeInTheDocument();
    expect(screen.queryByText("Taller Hermanos SA")).not.toBeInTheDocument();
    expect(screen.queryByText("Transportes Sur SRL")).not.toBeInTheDocument();
  });

  it("filtra por empresas al presionar el chip 'Empresas'", () => {
    render(<ClientesPage />);

    fireEvent.click(screen.getByTestId("clientes-chip-empresa"));

    expect(screen.queryByText("Juan Perez")).not.toBeInTheDocument();
    expect(screen.queryByText("Maria Deuda")).not.toBeInTheDocument();
    expect(screen.getByText("Taller Hermanos SA")).toBeInTheDocument();
    expect(screen.getByText("Transportes Sur SRL")).toBeInTheDocument();
  });

  it("filtra por saldo pendiente al presionar el chip 'Saldo pendiente'", () => {
    render(<ClientesPage />);

    fireEvent.click(screen.getByTestId("clientes-chip-saldo-pendiente"));

    expect(screen.queryByText("Juan Perez")).not.toBeInTheDocument();
    expect(screen.getByText("Maria Deuda")).toBeInTheDocument();
    expect(screen.queryByText("Taller Hermanos SA")).not.toBeInTheDocument();
    expect(screen.getByText("Transportes Sur SRL")).toBeInTheDocument();
  });

  it("filtra por saldo al día al presionar el chip 'Saldo al día'", () => {
    render(<ClientesPage />);

    fireEvent.click(screen.getByTestId("clientes-chip-saldo-al-dia"));

    expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    expect(screen.queryByText("Maria Deuda")).not.toBeInTheDocument();
    expect(screen.getByText("Taller Hermanos SA")).toBeInTheDocument();
    expect(screen.queryByText("Transportes Sur SRL")).not.toBeInTheDocument();
    expect(screen.queryByText("Logística con Crédito SA")).not.toBeInTheDocument();
  });

  it("filtra por saldo a favor sin mezclar clientes al día o con deuda", () => {
    render(<ClientesPage />);

    fireEvent.click(screen.getByTestId("clientes-chip-saldo-a-favor"));

    expect(screen.getByText("Logística con Crédito SA")).toBeInTheDocument();
    expect(screen.queryByText("Juan Perez")).not.toBeInTheDocument();
    expect(screen.queryByText("Maria Deuda")).not.toBeInTheDocument();
    expect(screen.queryByText("Transportes Sur SRL")).not.toBeInTheDocument();
  });

  it("combina filtros: Empresas con Saldo pendiente", () => {
    render(<ClientesPage />);

    fireEvent.click(screen.getByTestId("clientes-chip-empresa"));
    fireEvent.click(screen.getByTestId("clientes-chip-saldo-pendiente"));

    expect(screen.queryByText("Juan Perez")).not.toBeInTheDocument();
    expect(screen.queryByText("Maria Deuda")).not.toBeInTheDocument();
    expect(screen.queryByText("Taller Hermanos SA")).not.toBeInTheDocument();
    expect(screen.getByText("Transportes Sur SRL")).toBeInTheDocument();
  });

  it("permite abrir el modal con el botón 'Filtrar' y aplicar filtros", () => {
    render(<ClientesPage />);

    // Abrir modal con botón Filtrar
    fireEvent.click(screen.getByTestId("clientes-open-filters"));
    expect(screen.getByText("Filtrar clientes")).toBeInTheDocument();

    // Seleccionar Particulares y Saldo al día
    fireEvent.change(screen.getByTestId("clientes-filter-tipo"), {
      target: { value: "particular" },
    });
    fireEvent.change(screen.getByTestId("clientes-filter-saldo"), {
      target: { value: "AL_DIA" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    // Solo Juan Perez cumple ser Particular y Saldo al día
    expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    expect(screen.queryByText("Maria Deuda")).not.toBeInTheDocument();
    expect(screen.queryByText("Taller Hermanos SA")).not.toBeInTheDocument();
    expect(screen.queryByText("Transportes Sur SRL")).not.toBeInTheDocument();
  });

  it("restablece los filtros al hacer clic en 'Limpiar filtros'", () => {
    render(<ClientesPage />);

    fireEvent.click(screen.getByTestId("clientes-chip-empresa"));
    expect(screen.getByTestId("clientes-clear-filters")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("clientes-clear-filters"));

    expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    expect(screen.getByText("Maria Deuda")).toBeInTheDocument();
    expect(screen.getByText("Taller Hermanos SA")).toBeInTheDocument();
    expect(screen.getByText("Transportes Sur SRL")).toBeInTheDocument();
  });
});
