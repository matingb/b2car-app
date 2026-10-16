import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ArregloModal from "./ArregloModal";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  fetchById: vi.fn(),
  confirm: vi.fn(),
  successToast: vi.fn(),
  errorToast: vi.fn(),
}));

vi.mock("@/app/providers/VehiculosProvider", () => ({
  useVehiculos: () => ({
    vehiculos: [{ id: "veh-1", patente: "ABC123", marca: "Ford", modelo: "Fiesta" }],
    fetchAll: vi.fn(),
  }),
}));

vi.mock("@/app/providers/ArreglosProvider", () => ({
  useArreglos: () => ({
    create: mocks.create,
    update: mocks.update,
    fetchById: mocks.fetchById,
  }),
}));

vi.mock("@/app/providers/CuentasFinancierasProvider", () => ({
  useCuentasFinancieras: () => ({
    loading: false,
    createCuenta: vi.fn(),
  }),
}));

vi.mock("@/app/providers/TenantProvider", () => ({
  useTenant: () => ({
    tallerSeleccionadoId: "taller-1",
    hasPermission: () => true,
  }),
}));

vi.mock("@/app/providers/InventarioProvider", () => ({
  useInventario: () => ({
    inventario: [],
    isLoading: false,
    loadInventarioByTaller: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/app/providers/ModalMessageProvider", () => ({
  useModalMessage: () => ({
    confirm: mocks.confirm,
    alert: vi.fn(),
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: mocks.successToast,
    error: mocks.errorToast,
  }),
}));

vi.mock("@/app/providers/CategoriasArregloProvider", () => ({
  useCategoriasArreglo: () => ({ categorias: [], isLoading: false }),
}));

vi.mock("@/app/providers/EmpleadosProvider", () => ({
  useEmpleados: () => ({ empleados: [], isLoading: false }),
}));

describe("ArregloModal - toggle de IVA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mantiene el estado del toggle de IVA durante el guardado y ante re-renders del padre", async () => {
    let resolveUpdate: (val: unknown) => void = () => {};
    mocks.update.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        })
    );

    const initial = {
      id: "arr-1",
      estado: "EN_PROCESO" as const,
      fecha: "2026-10-13T10:00:00Z",
      kilometraje_leido: 50000,
      combustible_leido: 50,
      precio_final: 10000,
      precios_incluyen_iva: true,
      es_facturable: true,
      observaciones: "Test",
    };

    const onClose = vi.fn();

    const { rerender } = render(
      <ArregloModal
        open={true}
        vehiculoId="veh-1"
        initial={{ ...initial }}
        onClose={onClose}
      />
    );

    const toggle = screen.getByTestId("toggle-iva");
    expect(toggle).toHaveAttribute("aria-checked", "false");

    // El usuario activa el toggle de IVA
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");

    // Simulamos un re-render del padre (por ejemplo, con un nuevo objeto initial con valores viejos)
    rerender(
      <ArregloModal
        open={true}
        vehiculoId="veh-1"
        initial={{ ...initial }}
        onClose={onClose}
      />
    );

    // El toggle NO debe volver a false
    expect(toggle).toHaveAttribute("aria-checked", "true");

    // Al apretar guardar
    const submitBtn = screen.getByRole("button", { name: "Guardar cambios" });
    fireEvent.click(submitBtn);

    // Mientras la actualización está en vuelo (submitting=true)
    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledTimes(1);
    });

    expect(mocks.update).toHaveBeenCalledWith(
      "arr-1",
      expect.objectContaining({
        precios_incluyen_iva: false,
      })
    );

    // Simulamos otro re-render del padre que ocurre mientras update() está en vuelo
    rerender(
      <ArregloModal
        open={true}
        vehiculoId="veh-1"
        initial={{ ...initial }}
        onClose={onClose}
      />
    );

    // El toggle debe continuar en true, sin transición ni reseteo
    expect(toggle).toHaveAttribute("aria-checked", "true");

    // Completamos el guardado
    resolveUpdate({
      id: "arr-1",
      precios_incluyen_iva: false,
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledWith(true);
    });
  });
});
