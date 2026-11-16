import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import VehiculosPage from "./page";
import { createVehiculo } from "@/tests/factories";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/app/providers/SheetProvider", () => ({
  useSheet: () => ({
    openSheet: vi.fn(),
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

const mockVehiculos = [
  createVehiculo({
    id: "v1",
    patente: "AB123CD",
    marca: "Ford",
    modelo: "Focus",
    cliente_id: "c1",
    nombre_cliente: "Juan Perez",
  }),
  createVehiculo({
    id: "v2",
    patente: "XY789ZT",
    marca: "Toyota",
    modelo: "Corolla",
    cliente_id: "c2",
    nombre_cliente: "Maria Lopez",
  }),
];

const mocks = vi.hoisted(() => ({
  fetchAll: vi.fn(),
}));

vi.mock("@/app/providers/VehiculosProvider", () => ({
  useVehiculos: () => ({
    vehiculos: mockVehiculos,
    loading: false,
    hasMore: false,
    fetchAll: mocks.fetchAll,
    create: vi.fn(),
  }),
}));

describe("VehiculosPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchAll.mockResolvedValue(mockVehiculos);
  });

  it("renderiza el título, buscador y botón de crear", () => {
    render(<VehiculosPage />);

    expect(screen.getByText("Vehículos")).toBeInTheDocument();
    expect(screen.getByTestId("vehiculos-search")).toBeInTheDocument();
    expect(screen.getByTestId("vehiculos-open-create")).toBeInTheDocument();
  });

  it("renderiza la lista de vehículos y navega al hacer clic en una tarjeta", () => {
    render(<VehiculosPage />);

    const card = screen.getByText("AB123CD");
    expect(card).toBeInTheDocument();
    expect(screen.getByText("XY789ZT")).toBeInTheDocument();

    fireEvent.click(card);
    expect(mockPush).toHaveBeenCalledWith("/vehiculos/v1");
  });

  it("llama a fetchAll con búsqueda paginada al tipear en el buscador (permite buscar por cliente o datos de vehículo)", async () => {
    render(<VehiculosPage />);

    const searchInput = screen.getByTestId("vehiculos-search");
    fireEvent.change(searchInput, { target: { value: "Juan Perez" } });

    await waitFor(() => {
      expect(mocks.fetchAll).toHaveBeenCalledWith({
        limit: 50,
        search: "Juan Perez",
      });
    });
  });

  it("abre el modal de crear vehículo", () => {
    render(<VehiculosPage />);

    fireEvent.click(screen.getByTestId("vehiculos-open-create"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
