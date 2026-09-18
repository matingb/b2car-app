import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ClientesPage from "./page";
import { Cliente, TipoCliente } from "@/model/types";

import { PermissionValue } from "@/lib/permissions";

let talleresMock: Array<{ id: string; nombre: string; ubicacion: string }> = [];
let hasPermissionMock: (p: PermissionValue) => boolean = () => true;
vi.mock("@/app/providers/TenantProvider", () => ({
  useTenant: () => ({
    talleres: talleresMock,
    tallerSeleccionadoId: talleresMock[0]?.id ?? "",
    setTallerSeleccionadoId: vi.fn(),
    hasPermission: (p: PermissionValue) => hasPermissionMock(p),
  }),
}));

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

let mockClientesState = [...mockClientes];
let listeners: Array<() => void> = [];

const mockFetchAll = vi.fn((filters?: {
  tipo?: string;
  saldo?: string;
  search?: string;
  limit?: number;
}) => {
  let list = [...mockClientes];
  if (filters?.tipo) {
    list = list.filter((c) => c.tipo_cliente === filters.tipo);
  }
  if (filters?.saldo === "PENDIENTE") {
    list = list.filter((c) => (c.saldo_cuenta ?? 0) > 0);
  } else if (filters?.saldo === "AL_DIA") {
    list = list.filter((c) => (c.saldo_cuenta ?? 0) === 0);
  } else if (filters?.saldo === "A_FAVOR") {
    list = list.filter((c) => (c.saldo_cuenta ?? 0) < 0);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    list = list.filter((c) =>
      c.nombre.toLowerCase().includes(q) || (c.email && c.email.toLowerCase().includes(q))
    );
  }
  mockClientesState = list;
  listeners.forEach((l) => l());
  return Promise.resolve(list);
});

vi.mock("@/app/providers/ClientesProvider", () => ({
  useClientes: () => {
    const [, forceUpdate] = React.useState(0);
    React.useEffect(() => {
      const listener = () => forceUpdate((n) => n + 1);
      listeners.push(listener);
      return () => {
        listeners = listeners.filter((l) => l !== listener);
      };
    }, []);

    return {
      clientes: mockClientesState,
      loading: false,
      hasMore: false,
      fetchAll: mockFetchAll,
      createParticular: vi.fn(),
      createEmpresa: vi.fn(),
      deleteCliente: vi.fn(),
    };
  },
}));

async function renderAndFlush() {
  render(<ClientesPage />);
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
}

async function clickAndFlush(element: HTMLElement) {
  fireEvent.click(element);
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
}

describe("ClientesPage Filtros", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClientesState = [...mockClientes];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renderiza todos los clientes por defecto", async () => {
    await renderAndFlush();

    expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    expect(screen.getByText("Maria Deuda")).toBeInTheDocument();
    expect(screen.getByText("Taller Hermanos SA")).toBeInTheDocument();
    expect(screen.getByText("Transportes Sur SRL")).toBeInTheDocument();
    expect(screen.getByText("Logística con Crédito SA")).toBeInTheDocument();
    expect(screen.getByTestId("clientes-open-filters")).toBeInTheDocument();
  });

  it("filtra por particulares al presionar el chip 'Particulares'", async () => {
    await renderAndFlush();

    await clickAndFlush(screen.getByTestId("clientes-chip-particular"));

    expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    expect(screen.getByText("Maria Deuda")).toBeInTheDocument();
    expect(screen.queryByText("Taller Hermanos SA")).not.toBeInTheDocument();
    expect(screen.queryByText("Transportes Sur SRL")).not.toBeInTheDocument();
  });

  it("filtra por empresas al presionar el chip 'Empresas'", async () => {
    await renderAndFlush();

    await clickAndFlush(screen.getByTestId("clientes-chip-empresa"));

    expect(screen.queryByText("Juan Perez")).not.toBeInTheDocument();
    expect(screen.queryByText("Maria Deuda")).not.toBeInTheDocument();
    expect(screen.getByText("Taller Hermanos SA")).toBeInTheDocument();
    expect(screen.getByText("Transportes Sur SRL")).toBeInTheDocument();
  });

  it("filtra por saldo pendiente al presionar el chip 'Saldo pendiente'", async () => {
    await renderAndFlush();

    await clickAndFlush(screen.getByTestId("clientes-chip-saldo-pendiente"));

    expect(screen.queryByText("Juan Perez")).not.toBeInTheDocument();
    expect(screen.getByText("Maria Deuda")).toBeInTheDocument();
    expect(screen.queryByText("Taller Hermanos SA")).not.toBeInTheDocument();
    expect(screen.getByText("Transportes Sur SRL")).toBeInTheDocument();
  });

  it("filtra por saldo al día al presionar el chip 'Saldo al día'", async () => {
    await renderAndFlush();

    await clickAndFlush(screen.getByTestId("clientes-chip-saldo-al-dia"));

    expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    expect(screen.queryByText("Maria Deuda")).not.toBeInTheDocument();
    expect(screen.getByText("Taller Hermanos SA")).toBeInTheDocument();
    expect(screen.queryByText("Transportes Sur SRL")).not.toBeInTheDocument();
    expect(screen.queryByText("Logística con Crédito SA")).not.toBeInTheDocument();
  });

  it("filtra por saldo a favor sin mezclar clientes al día o con deuda", async () => {
    await renderAndFlush();

    await clickAndFlush(screen.getByTestId("clientes-chip-saldo-a-favor"));

    expect(screen.getByText("Logística con Crédito SA")).toBeInTheDocument();
    expect(screen.queryByText("Juan Perez")).not.toBeInTheDocument();
    expect(screen.queryByText("Maria Deuda")).not.toBeInTheDocument();
    expect(screen.queryByText("Transportes Sur SRL")).not.toBeInTheDocument();
  });

  it("combina filtros: Empresas con Saldo pendiente", async () => {
    await renderAndFlush();

    await clickAndFlush(screen.getByTestId("clientes-chip-empresa"));
    await clickAndFlush(screen.getByTestId("clientes-chip-saldo-pendiente"));

    expect(screen.queryByText("Juan Perez")).not.toBeInTheDocument();
    expect(screen.queryByText("Maria Deuda")).not.toBeInTheDocument();
    expect(screen.queryByText("Taller Hermanos SA")).not.toBeInTheDocument();
    expect(screen.getByText("Transportes Sur SRL")).toBeInTheDocument();
  });

  it("permite abrir el modal con el botón 'Filtrar' y aplicar filtros", async () => {
    await renderAndFlush();

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

    await clickAndFlush(screen.getByRole("button", { name: "Aplicar filtros" }));

    // Solo Juan Perez cumple ser Particular y Saldo al día
    expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    expect(screen.queryByText("Maria Deuda")).not.toBeInTheDocument();
    expect(screen.queryByText("Taller Hermanos SA")).not.toBeInTheDocument();
    expect(screen.queryByText("Transportes Sur SRL")).not.toBeInTheDocument();
  });

  it("oculta el listado y muestra un spinner mientras se ejecuta la búsqueda debounceada", async () => {
    await renderAndFlush();

    let resolveBusqueda: (() => void) | undefined;
    mockFetchAll.mockImplementationOnce((filters) => {
      return new Promise((resolve) => {
        resolveBusqueda = () => {
          mockClientesState = mockClientes.filter((c) =>
            c.nombre.toLowerCase().includes((filters?.search ?? "").toLowerCase())
          );
          listeners.forEach((l) => l());
          resolve(mockClientesState);
        };
      });
    });

    fireEvent.change(screen.getByTestId("clientes-search"), {
      target: { value: "Juan" },
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByTestId("clientes-search-loading")).toBeInTheDocument();
    expect(screen.queryByText("Juan Perez")).not.toBeInTheDocument();
    expect(screen.queryByText("Maria Deuda")).not.toBeInTheDocument();

    await act(async () => {
      resolveBusqueda?.();
    });

    expect(screen.queryByTestId("clientes-search-loading")).not.toBeInTheDocument();
    expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    expect(screen.queryByText("Maria Deuda")).not.toBeInTheDocument();
  });

  it("restablece los filtros al hacer clic en 'Limpiar filtros'", async () => {
    await renderAndFlush();

    await clickAndFlush(screen.getByTestId("clientes-chip-empresa"));
    expect(screen.getByTestId("clientes-clear-filters")).toBeInTheDocument();

    await clickAndFlush(screen.getByTestId("clientes-clear-filters"));

    expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    expect(screen.getByText("Maria Deuda")).toBeInTheDocument();
    expect(screen.getByText("Taller Hermanos SA")).toBeInTheDocument();
    expect(screen.getByText("Transportes Sur SRL")).toBeInTheDocument();
  });
});
