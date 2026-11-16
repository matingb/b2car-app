import { render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Vehiculo } from "@/model/types";
import { VehiculosProvider, useVehiculos } from "./VehiculosProvider";
import { vehiculoClient } from "@/clients/vehiculoClient";
import { createVehiculo } from "@/tests/factories";

vi.mock("@/clients/vehiculoClient", () => ({
  vehiculoClient: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getClienteForVehiculo: vi.fn(),
    reassignPropietario: vi.fn(),
  },
}));

describe("VehiculosProvider", () => {
  const v1 = createVehiculo({ id: "v1", patente: "AB123CD", marca: "Ford", modelo: "Focus" });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(vehiculoClient.getAll).mockResolvedValue({
      data: [v1],
      page: { hasMore: false },
      error: null,
    });
    vi.mocked(vehiculoClient.getById).mockResolvedValue({
      data: v1,
      arreglos: [],
      error: null,
    });
  });

  it("lanza un error si se usa useVehiculos fuera del VehiculosProvider", () => {
    function TestProbe() {
      useVehiculos();
      return null;
    }

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestProbe />)).toThrow(
      "useVehiculos debe usarse dentro de VehiculosProvider"
    );
    consoleSpy.mockRestore();
  });

  it("dentro del provider searchVehiculos consulta vehiculoClient y guarda en caché", async () => {
    function TestConsumer() {
      const { searchVehiculos, getVehiculoById } = useVehiculos();
      const [count, setCount] = useState(0);
      const [cached, setCached] = useState<string>("");

      return (
        <div>
          <button
            type="button"
            onClick={async () => {
              const res = await searchVehiculos("Ford");
              setCount(res.length);
            }}
          >
            Buscar
          </button>
          <button
            type="button"
            onClick={async () => {
              const found = await getVehiculoById("v1");
              setCached(found?.patente ?? "");
            }}
          >
            Cargar v1
          </button>
          <span data-testid="search-count">{count}</span>
          <span data-testid="cached-patente">{cached}</span>
        </div>
      );
    }

    render(
      <VehiculosProvider>
        <TestConsumer />
      </VehiculosProvider>
    );

    screen.getByRole("button", { name: "Buscar" }).click();
    await waitFor(() => {
      expect(vehiculoClient.getAll).toHaveBeenCalledWith({
        search: "Ford",
        cliente_id: undefined,
        limit: 25,
        page: undefined,
      });
      expect(screen.getByTestId("search-count")).toHaveTextContent("1");
    });

    vi.mocked(vehiculoClient.getById).mockClear();
    screen.getByRole("button", { name: "Cargar v1" }).click();
    await waitFor(() => {
      expect(screen.getByTestId("cached-patente")).toHaveTextContent("AB123CD");
    });
    expect(vehiculoClient.getById).not.toHaveBeenCalled();
  });

  it("dentro del provider carga los vehículos y maneja caché en getVehiculoById", async () => {
    function TestConsumer() {
      const { vehiculos, getVehiculoById } = useVehiculos();
      const [item, setItem] = useState<Vehiculo | null>(null);

      return (
        <div>
          <span data-testid="vehiculos-count">{vehiculos.length}</span>
          <button
            type="button"
            onClick={async () => {
              const res = await getVehiculoById("v1");
              setItem(res);
            }}
          >
            Cargar v1
          </button>
          <span data-testid="item-patente">{item?.patente ?? "ninguno"}</span>
        </div>
      );
    }

    render(
      <VehiculosProvider>
        <TestConsumer />
      </VehiculosProvider>
    );

    // Initial fetchAll
    await waitFor(() => {
      expect(screen.getByTestId("vehiculos-count")).toHaveTextContent("1");
    });

    // Cargar v1 uses cache populated by fetchAll, without calling getById
    screen.getByRole("button", { name: "Cargar v1" }).click();
    await waitFor(() => {
      expect(screen.getByTestId("item-patente")).toHaveTextContent("AB123CD");
    });
    expect(vehiculoClient.getById).not.toHaveBeenCalled();
  });
});
