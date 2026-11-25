import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ArregloModal from "./ArregloModal";
import type { Arreglo } from "@/model/types";

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
    vehiculos: [{ id: "veh-1", patente: "ABC123", marca: "Ford", modelo: "Fiesta", cliente_id: "c1" }],
    fetchAll: vi.fn(),
    searchVehiculos: vi.fn().mockResolvedValue([]),
    getVehiculoById: vi.fn().mockResolvedValue(null),
  }),
}));

vi.mock("@/app/providers/ClientesProvider", () => ({
  useClientes: () => ({
    clientes: [{ id: "c1", nombre: "Cliente Test", tipo_cliente: "particular" }],
    loading: false,
    searchClientes: vi.fn().mockResolvedValue([]),
    getClienteById: vi.fn().mockResolvedValue(null),
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

    const initialArreglo = initial as unknown as Arreglo;

    const { rerender } = render(
      <ArregloModal
        open={true}
        vehiculoId="veh-1"
        initial={{ ...initialArreglo }}
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
        initial={{ ...initialArreglo }}
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
        initial={{ ...initialArreglo }}
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

  it("renderiza el buscador de vehículo al abrir el modal para crear arreglo sin vehiculoId", () => {
    render(
      <ArregloModal
        open={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId("arreglo-vehiculo-autocomplete")).toBeInTheDocument();
  });

  it("al crear un arreglo con descuento en una línea, el modal actualiza el total y envía precio_final con descuento", async () => {
    mocks.create.mockResolvedValue({
      id: "arr-created",
      precio_final: 8000,
      esta_pago: false,
    });
    mocks.confirm.mockResolvedValue(false);

    const onClose = vi.fn();

    render(
      <ArregloModal
        open={true}
        vehiculoId="veh-1"
        onClose={onClose}
      />
    );

    // Agregar un servicio con descuento
    fireEvent.click(screen.getByRole("button", { name: /agregar mano de obra/i }));

    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "Alineación y balanceo" } });
    fireEvent.change(screen.getByLabelText("Precio venta"), { target: { value: "10000" } });
    fireEvent.change(screen.getByLabelText("Descuento"), { target: { value: "2000" } });

    fireEvent.click(screen.getByRole("button", { name: "agregar servicio" }));

    // El total del modal debe mostrar $8.000 (y desglose con Subtotal y Descuento)
    expect(screen.getByText(/Subtotal:\s*\$10\.000/)).toBeInTheDocument();
    expect(screen.getByText(/Descuento:\s*-\$2\.000/)).toBeInTheDocument();
    expect(screen.getAllByText("$8.000").length).toBeGreaterThanOrEqual(2);

    // Guardar (crear arreglo)
    const submitBtn = screen.getByRole("button", { name: "Crear" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mocks.create).toHaveBeenCalledTimes(1);
    });

    // Debe enviar precio_final: 8000 (no 10000)
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        precio_final: 8000,
        detalles: [
          expect.objectContaining({
            descripcion: "Alineación y balanceo",
            descuento: 2000,
          }),
        ],
      })
    );
  });
});
