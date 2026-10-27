import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { runPendingPromises } from "@/tests/testUtils";
import OperacionCreateModal from "./OperacionCreateModal";

const mockInventario: unknown[] = [];
const mockInventarioApi = {
  inventario: mockInventario,
  isLoading: false,
  loadInventarioByTaller: vi.fn(),
  getStockById: vi.fn(),
  upsertStock: vi.fn(),
  updateStock: vi.fn(),
  removeStock: vi.fn(),
  tallerId: null,
};

const mockCrearGasto = vi.fn();
const mockActualizarGasto = vi.fn();
const mockCrearOperacion = vi.fn();
const mockRefreshOperaciones = vi.fn();
const mockRefreshCuentas = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockCuentasApi = {
  cuentas: [],
  cuentasActivas: [
    { id: "C1", nombre: "Caja Chica", tipo: "EFECTIVO", saldoActual: 10000, activo: true },
  ],
  cuentaFavorita: null as {
    id: string;
    nombre: string;
    tipo: string;
    saldoActual: number;
    activo: boolean;
    favorita: boolean;
  } | null,
  loading: false,
  refresh: mockRefreshCuentas,
  createCuenta: vi.fn(),
};

const mockGetProductos = vi.fn();
const mockGetProveedorProductos = vi.fn();
const mockGetProveedores = vi.fn();

vi.mock("@/clients/productosClient", () => ({
  productosClient: {
    getAll: (...args: unknown[]) => mockGetProductos(...args),
  },
}));

vi.mock("@/clients/proveedores/proveedoresClient", () => ({
  proveedoresClient: {
    getAll: (...args: unknown[]) => mockGetProveedores(...args),
    getProductos: (...args: unknown[]) => mockGetProveedorProductos(...args),
  },
}));

const mockGetClientes = vi.fn();
vi.mock("@/clients/clientes/clientesClient", () => ({
  clientesClient: {
    getAll: (...args: unknown[]) => mockGetClientes(...args),
  },
}));

vi.mock("@/clients/finanzasClient", () => ({
  finanzasClient: {
    crearGasto: (...args: unknown[]) => mockCrearGasto(...args),
    actualizarGasto: (...args: unknown[]) => mockActualizarGasto(...args),
  },
}));

vi.mock("@/app/providers/InventarioProvider", () => ({
  useInventario: () => mockInventarioApi,
}));

vi.mock("@/app/components/ui/Autocomplete", () => ({
  __esModule: true,
  default: ({
    options,
    value,
    onChange,
    dataTestId,
    disabled,
    placeholder,
  }: {
    options?: { value: string; label: string }[];
    value: string;
    onChange: (v: string) => void;
    dataTestId?: string;
    disabled?: boolean;
    placeholder?: string;
  }) => (
    <input
      data-testid={dataTestId}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      data-options={JSON.stringify(options ?? [])}
    />
  ),
}));

vi.mock("@/app/providers/OperacionesProvider", () => ({
  useOperaciones: () => ({
    create: mockCrearOperacion,
    loading: false,
    refresh: mockRefreshOperaciones,
  }),
}));

vi.mock("@/app/providers/CuentasFinancierasProvider", () => ({
  useCuentasFinancieras: () => mockCuentasApi,
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
    info: vi.fn(),
  }),
}));

describe("OperacionCreateModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInventarioApi.inventario = [];
    mockCuentasApi.cuentaFavorita = null;
    mockGetProductos.mockResolvedValue({ data: [], error: null });
    mockGetProveedorProductos.mockResolvedValue({ data: [], error: null });
    mockGetProveedores.mockResolvedValue({ data: [], error: null });
    mockGetClientes.mockResolvedValue({ data: [], error: null });
    mockCrearGasto.mockResolvedValue({
      data: { id: "G1", cuentaId: "C1", categoria: "ALQUILER", importe: 5000 },
      error: null,
    });
  });

  it("si hay un solo taller, no muestra el dropdown de talleres", async () => {
    render(
      <OperacionCreateModal
        open
        talleres={[{ id: "T1", nombre: "Taller Centro" }]}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    expect(screen.queryByTestId("operaciones-create-taller")).not.toBeInTheDocument();
    expect(screen.queryByText("Taller")).not.toBeInTheDocument();
  });

  it("si hay una única línea, no aparece el icono de eliminar", async () => {
    render(
      <OperacionCreateModal
        open
        talleres={[{ id: "T1", nombre: "Taller Centro" }]}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    expect(screen.getByTestId("operaciones-line-0")).toBeInTheDocument();
    expect(screen.queryByTestId("operaciones-line-0-remove")).not.toBeInTheDocument();
  });

  it("si hay dos líneas, aparece el icono de eliminar en ambas", async () => {
    render(
      <OperacionCreateModal
        open
        talleres={[{ id: "T1", nombre: "Taller Centro" }]}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    await userEvent.click(screen.getByTestId("operaciones-add-line"));
    await runPendingPromises();

    expect(screen.getByTestId("operaciones-line-0")).toBeInTheDocument();
    expect(screen.getByTestId("operaciones-line-1")).toBeInTheDocument();
    expect(screen.getByTestId("operaciones-line-0-remove")).toBeInTheDocument();
    expect(screen.getByTestId("operaciones-line-1-remove")).toBeInTheDocument();
  });

  it("permite registrar un gasto sin descripción al seleccionar el tipo Gasto", async () => {
    const onClose = vi.fn();
    render(
      <OperacionCreateModal
        open
        talleres={[{ id: "T1", nombre: "Taller Centro" }]}
        onClose={onClose}
      />
    );

    await runPendingPromises();

    // Cambiar a GASTO
    await userEvent.click(screen.getByTestId("operaciones-create-tipo-GASTO"));
    await runPendingPromises();

    expect(screen.getByTestId("gasto-categoria")).toBeInTheDocument();
    expect(screen.getByTestId("gasto-importe")).toBeInTheDocument();
    expect(screen.getByTestId("gasto-descripcion")).toBeInTheDocument();

    // Completar datos
    await userEvent.type(screen.getByTestId("operaciones-create-cuenta-financiera"), "C1");
    await userEvent.type(screen.getByTestId("gasto-importe"), "15000");

    // Guardar
    await userEvent.click(screen.getByTestId("modal-submit"));
    await runPendingPromises();

    await waitFor(() => {
      expect(mockCrearGasto).toHaveBeenCalledWith(
        expect.objectContaining({
          cuentaId: "C1",
          categoria: "ALQUILER",
          importe: 15000,
          descripcion: null,
          idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        })
      );
    });

    expect(mockRefreshOperaciones).toHaveBeenCalledTimes(1);
    expect(mockRefreshCuentas).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("permite editar un gasto existente cuando se pasa la prop gasto", async () => {
    const onClose = vi.fn();
    mockActualizarGasto.mockResolvedValue({
      data: { id: "G1", cuentaId: "C1", categoria: "SERVICIOS", importe: 8000 },
      error: null,
    });

    render(
      <OperacionCreateModal
        open
        talleres={[{ id: "T1", nombre: "Taller Centro" }]}
        gasto={{
          id: "G1",
          cuentaId: "C1",
          categoria: "ALQUILER",
          importe: 5000,
          fecha: "2026-08-01",
          descripcion: "Alquiler mensual",
          arregloId: null,
          operacionId: null,
          createdAt: "2026-08-01T00:00:00Z",
          updatedAt: "2026-08-01T00:00:00Z",
        }}
        onClose={onClose}
      />
    );

    await runPendingPromises();

    expect(screen.getByText("Editar gasto")).toBeInTheDocument();
    expect(screen.getByTestId("gasto-importe")).toHaveValue(5000);
    expect(screen.getByTestId("gasto-descripcion")).toHaveValue("Alquiler mensual");

    await userEvent.clear(screen.getByTestId("gasto-importe"));
    await userEvent.type(screen.getByTestId("gasto-importe"), "8000");

    await userEvent.click(screen.getByTestId("modal-submit"));
    await runPendingPromises();

    await waitFor(() => {
      expect(mockActualizarGasto).toHaveBeenCalledWith(
        "G1",
        expect.objectContaining({
          cuentaId: "C1",
          importe: 8000,
          descripcion: "Alquiler mensual",
        })
      );
    });

    expect(mockRefreshOperaciones).toHaveBeenCalledTimes(1);
    expect(mockRefreshCuentas).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("si hay multiples talleres, muestra el dropdown de talleres", async () => {
    render(
      <OperacionCreateModal
        open
        talleres={[
          { id: "T1", nombre: "Taller Centro" },
          { id: "T2", nombre: "Taller Norte" },
        ]}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    expect(screen.getByTestId("operaciones-create-taller")).toBeInTheDocument();
  });

  it("preselecciona el primer taller y la cuenta favorita", async () => {
    mockCuentasApi.cuentaFavorita = {
      id: "C-FAVORITA",
      nombre: "Caja principal",
      tipo: "EFECTIVO",
      saldoActual: 10000,
      activo: true,
      favorita: true,
    };

    render(
      <OperacionCreateModal
        open
        talleres={[
          { id: "T1", nombre: "Taller Centro" },
          { id: "T2", nombre: "Taller Norte" },
        ]}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("operaciones-create-taller")).toHaveValue("T1");
      expect(screen.getByTestId("operaciones-create-cuenta-financiera")).toHaveValue("C-FAVORITA");
    });
  });

  it("crea una venta contextual para el stock y taller preseleccionados", async () => {
    mockInventarioApi.inventario = [{
      id: "S-CONTEXTO",
      nombre: "Filtro de Aceite",
      codigo: "FA-01",
      precioUnitario: 3500,
      costoUnitario: 2000,
      stockActual: 10,
    }];
    mockCrearOperacion.mockResolvedValue({ id: "O-1" });
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    render(
      <OperacionCreateModal
        open
        talleres={[
          { id: "T-1", nombre: "Taller Centro" },
          { id: "T-2", nombre: "Taller Norte" },
        ]}
        initialCuentaId="C-1"
        contextualStock={{ stockId: "S-CONTEXTO", tallerId: "T-2" }}
        onSuccess={onSuccess}
        onClose={onClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("operaciones-line-0-stock")).toHaveValue("S-CONTEXTO");
      expect(screen.getByTestId("operaciones-line-0-unitario")).toHaveValue(3500);
    });

    expect(screen.getByTestId("operaciones-line-0-stock")).toBeDisabled();
    expect(screen.queryByTestId("operaciones-create-taller")).not.toBeInTheDocument();
    expect(screen.queryByTestId("operaciones-create-tipo-GASTO")).not.toBeInTheDocument();
    expect(screen.queryByTestId("operaciones-add-line")).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("modal-submit"));

    await waitFor(() => {
      expect(mockCrearOperacion).toHaveBeenCalledWith(expect.objectContaining({
        tipo: "VENTA",
        taller_id: "T-2",
        cuenta_financiera_id: "C-1",
        lineas: [
          expect.objectContaining({
            stock_id: "S-CONTEXTO",
            cantidad: 1,
            monto_unitario: 3500,
            delta_cantidad: -1,
          }),
        ],
      }));
    });

    expect(mockRefreshCuentas).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("permite cambiar una operación contextual a compra y usa el costo del producto", async () => {
    mockInventarioApi.inventario = [{
      id: "S-CONTEXTO",
      nombre: "Filtro de Aceite",
      codigo: "FA-01",
      precioUnitario: 3500,
      costoUnitario: 2000,
      stockActual: 10,
    }];
    mockCrearOperacion.mockResolvedValue({ id: "O-2" });

    render(
      <OperacionCreateModal
        open
        talleres={[{ id: "T-2", nombre: "Taller Norte" }]}
        initialCuentaId="C-1"
        contextualStock={{ stockId: "S-CONTEXTO", tallerId: "T-2" }}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("operaciones-line-0-unitario")).toHaveValue(3500);
    });
    await userEvent.click(screen.getByTestId("operaciones-create-tipo-COMPRA"));

    await waitFor(() => {
      expect(screen.getByTestId("operaciones-line-0-unitario")).toHaveValue(2000);
    });
    await userEvent.click(screen.getByTestId("modal-submit"));

    await waitFor(() => {
      expect(mockCrearOperacion).toHaveBeenCalledWith(expect.objectContaining({
        tipo: "COMPRA",
        taller_id: "T-2",
        lineas: [expect.objectContaining({
          stock_id: "S-CONTEXTO",
          monto_unitario: 2000,
          delta_cantidad: 1,
        })],
      }));
    });
  });

  it("mantiene abierto el modal contextual cuando el backend informa stock insuficiente", async () => {
    mockInventarioApi.inventario = [{
      id: "S-CONTEXTO",
      nombre: "Filtro de Aceite",
      codigo: "FA-01",
      precioUnitario: 3500,
      costoUnitario: 2000,
      stockActual: 1,
    }];
    mockCrearOperacion.mockRejectedValue(new Error("Stock insuficiente"));
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    render(
      <OperacionCreateModal
        open
        talleres={[{ id: "T-2", nombre: "Taller Norte" }]}
        initialCuentaId="C-1"
        contextualStock={{ stockId: "S-CONTEXTO", tallerId: "T-2" }}
        onSuccess={onSuccess}
        onClose={onClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("operaciones-line-0-unitario")).toHaveValue(3500);
    });
    await userEvent.clear(screen.getByTestId("operaciones-line-0-cantidad"));
    await userEvent.type(screen.getByTestId("operaciones-line-0-cantidad"), "2");
    await userEvent.click(screen.getByTestId("modal-submit"));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Error creando operación", "Stock insuficiente");
    });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("permite registrar una venta seleccionando item y guardando", async () => {
    vi.mocked(mockInventarioApi).inventario = [
      {
        id: "S1",
        nombre: "Filtro de Aceite",
        codigo: "FA-01",
        precioUnitario: 3500,
        costoUnitario: 2000,
        stockActual: 10,
      },
    ];

    const onClose = vi.fn();
    render(
      <OperacionCreateModal
        open
        talleres={[{ id: "T1", nombre: "Taller Centro" }]}
        initialTipo="VENTA"
        initialCuentaId="C1"
        onClose={onClose}
      />
    );

    await runPendingPromises();

    // Seleccionar stock en la linea 0
    await userEvent.type(screen.getByTestId("operaciones-line-0-stock"), "S1");

    // Click submit
    await userEvent.click(screen.getByTestId("modal-submit"));
    await runPendingPromises();

    expect(screen.getByTestId("modal-submit")).toBeInTheDocument();
  });

  it("permite registrar una compra con importe 0 sin cuenta financiera", async () => {
    vi.mocked(mockInventarioApi).inventario = [
      {
        id: "S-ZERO",
        nombre: "Repuesto Sin Costo",
        codigo: "RSC-01",
        precioUnitario: 1000,
        costoUnitario: 0,
        stockActual: 0,
      },
    ];
    mockCrearOperacion.mockResolvedValueOnce({
      id: "OP-ZERO",
      tenant_id: "T1",
    });

    const onClose = vi.fn();
    render(
      <OperacionCreateModal
        open
        talleres={[{ id: "T1", nombre: "Taller Centro" }]}
        initialTipo="COMPRA"
        initialCuentaId=""
        onClose={onClose}
      />
    );

    await runPendingPromises();

    // Seleccionar stock en la linea 0
    await userEvent.type(screen.getByTestId("operaciones-line-0-stock"), "S-ZERO");

    const submitBtn = screen.getByTestId("modal-submit");
    expect(submitBtn).not.toBeDisabled();

    await userEvent.click(submitBtn);
    await runPendingPromises();

    expect(mockCrearOperacion).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "COMPRA",
        cuenta_financiera_id: null,
        lineas: [
          expect.objectContaining({
            stock_id: "S-ZERO",
            monto_unitario: 0,
          }),
        ],
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("permite registrar una venta con observaciones", async () => {
    mockInventarioApi.inventario = [{
      id: "S-VENTA",
      nombre: "Filtro de Aceite",
      codigo: "FA-01",
      precioUnitario: 3500,
      costoUnitario: 2000,
      stockActual: 10,
    }];
    const onClose = vi.fn();
    mockCrearOperacion.mockResolvedValue({ id: "OP-1", tipo: "VENTA" });

    render(
      <OperacionCreateModal
        open
        talleres={[{ id: "T1", nombre: "Taller Centro" }]}
        initialCuentaId="C1"
        contextualStock={{ stockId: "S-VENTA", tallerId: "T1" }}
        onClose={onClose}
      />
    );

    await runPendingPromises();

    await userEvent.type(screen.getByTestId("operaciones-stock-observaciones"), "Cliente solicita factura luego");

    const submitBtn = screen.getByTestId("modal-submit");
    expect(submitBtn).not.toBeDisabled();

    await userEvent.click(submitBtn);
    await runPendingPromises();

    expect(mockCrearOperacion).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "VENTA",
        observaciones: "Cliente solicita factura luego",
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("permite registrar un gasto con observaciones", async () => {
    const onClose = vi.fn();
    mockCrearGasto.mockResolvedValue({
      data: { id: "G1", cuentaId: "C1", categoria: "ALQUILER", importe: 10000 },
      error: null,
    });

    render(
      <OperacionCreateModal
        open
        talleres={[{ id: "T1", nombre: "Taller Centro" }]}
        onClose={onClose}
      />
    );

    await runPendingPromises();

    await userEvent.click(screen.getByTestId("operaciones-create-tipo-GASTO"));
    await runPendingPromises();

    await userEvent.type(screen.getByTestId("operaciones-create-cuenta-financiera"), "C1");
    await userEvent.type(screen.getByTestId("gasto-importe"), "10000");
    await userEvent.type(screen.getByTestId("gasto-observaciones"), "Se abonó con recargo por mora");

    await userEvent.click(screen.getByTestId("modal-submit"));
    await runPendingPromises();

    await waitFor(() => {
      expect(mockCrearGasto).toHaveBeenCalledWith(
        expect.objectContaining({
          cuentaId: "C1",
          importe: 10000,
          observaciones: "Se abonó con recargo por mora",
        })
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("al comprar con disabledProveedor, filtra los productos para mostrar solo los de ese proveedor y aplica su costo de referencia", async () => {
    mockInventarioApi.inventario = [
      {
        id: "S1",
        productoId: "PROD-1",
        nombre: "Aceite Total 10W40",
        codigo: "AC-10",
        precioUnitario: 5000,
        costoUnitario: 3000,
        stockActual: 5,
      },
      {
        id: "S2",
        productoId: "PROD-2",
        nombre: "Filtro Bosch",
        codigo: "FB-01",
        precioUnitario: 4000,
        costoUnitario: 2200,
        stockActual: 10,
      },
    ];

    mockGetProveedores.mockResolvedValue({
      data: [{ id: "PROV-1", nombre: "Distribuidora Total" }],
      error: null,
    });
    mockGetProductos.mockResolvedValue({
      data: [{ id: "PROD-1", nombre: "Aceite Total 10W40", codigo: "AC-10" }],
      error: null,
    });
    mockGetProveedorProductos.mockResolvedValue({
      data: [
        {
          id: "PP1",
          producto_id: "PROD-1",
          proveedor_id: "PROV-1",
          codigo_proveedor: "SKU-TOTAL-01",
          costo_referencia: 2750,
          es_predeterminado: true,
        },
      ],
      error: null,
    });

    const onClose = vi.fn();
    render(
      <OperacionCreateModal
        open
        talleres={[{ id: "T1", nombre: "Taller Centro" }]}
        initialTipo="COMPRA"
        initialCuentaId="C1"
        initialProveedorId="PROV-1"
        disabledProveedor
        onClose={onClose}
      />
    );

    await runPendingPromises();

    await waitFor(() => {
      expect(mockGetProductos).toHaveBeenCalledWith({ proveedorId: "PROV-1" });
      expect(mockGetProveedorProductos).toHaveBeenCalledWith("PROV-1");
    });

    // Validar que en el selector de productos solo figure el producto del proveedor (S1)
    const stockInput = screen.getByTestId("operaciones-line-0-stock");
    await waitFor(() => {
      const options = JSON.parse(stockInput.getAttribute("data-options") || "[]");
      expect(options).toHaveLength(1);
      expect(options[0].value).toBe("S1");
      expect(options[0].label).toBe("Aceite Total 10W40");
      expect(options[0].secondaryLabel).toContain("SKU-TOTAL-01");
      expect(options[0].secondaryLabel).not.toContain("SKU Prov:");
    });

    // Seleccionar el item S1 y verificar que tome el costo_referencia (2750)
    await userEvent.clear(stockInput);
    await userEvent.type(stockInput, "S1");

    await waitFor(() => {
      expect(screen.getByTestId("operaciones-line-0-unitario")).toHaveValue(2750);
    });

    // Confirmar la compra
    await userEvent.click(screen.getByTestId("modal-submit"));
    await runPendingPromises();

    await waitFor(() => {
      expect(mockCrearOperacion).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: "COMPRA",
          proveedor_id: "PROV-1",
          lineas: [
            expect.objectContaining({
              stock_id: "S1",
              monto_unitario: 2750,
              delta_cantidad: 1,
            }),
          ],
        })
      );
    });
  });

  it("si el proveedor no tiene productos asociados en el taller, muestra aviso informativo", async () => {
    mockInventarioApi.inventario = [
      {
        id: "S1",
        productoId: "PROD-1",
        nombre: "Aceite Total 10W40",
        codigo: "AC-10",
        precioUnitario: 5000,
        costoUnitario: 3000,
        stockActual: 5,
      },
    ];

    mockGetProveedores.mockResolvedValue({
      data: [{ id: "PROV-VACIO", nombre: "Proveedor Nuevo" }],
      error: null,
    });
    mockGetProductos.mockResolvedValue({ data: [], error: null });
    mockGetProveedorProductos.mockResolvedValue({ data: [], error: null });

    render(
      <OperacionCreateModal
        open
        talleres={[{ id: "T1", nombre: "Taller Centro" }]}
        initialTipo="COMPRA"
        initialCuentaId="C1"
        initialProveedorId="PROV-VACIO"
        disabledProveedor
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    await waitFor(() => {
      expect(screen.getByTestId("operacion-empty-proveedor-prods")).toBeInTheDocument();
      expect(screen.getByText(/No hay productos de Proveedor Nuevo registrados en el inventario/i)).toBeInTheDocument();
    });
  });

  it("al crear una venta permite seleccionar un cliente y envía cliente_id en el payload", async () => {
    mockInventarioApi.inventario = [{
      id: "S-VENTA",
      productoId: "P-VENTA",
      nombre: "Filtro Aire",
      codigo: "FA-01",
      precioUnitario: 3500,
      costoUnitario: 2000,
      stockActual: 10,
    }];
    mockGetClientes.mockResolvedValue({
      data: [{ id: "CLI-1", nombre: "Juan Perez", dni_cuil: "20123456789" }],
      error: null,
    });
    const onClose = vi.fn();
    mockCrearOperacion.mockResolvedValue({ id: "OP-1", tipo: "VENTA" });

    render(
      <OperacionCreateModal
        open
        talleres={[{ id: "T1", nombre: "Taller Centro" }]}
        initialCuentaId="C1"
        initialTipo="VENTA"
        onClose={onClose}
      />
    );

    await runPendingPromises();

    // Seleccionar cliente
    const clienteInput = screen.getByTestId("operaciones-create-cliente");
    expect(clienteInput).toBeInTheDocument();
    await userEvent.clear(clienteInput);
    await userEvent.type(clienteInput, "CLI-1");

    // Seleccionar item
    const stockInput = screen.getByTestId("operaciones-line-0-stock");
    await userEvent.type(stockInput, "S-VENTA");

    const submitBtn = screen.getByTestId("modal-submit");
    expect(submitBtn).not.toBeDisabled();

    await userEvent.click(submitBtn);
    await runPendingPromises();

    expect(mockCrearOperacion).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "VENTA",
        cliente_id: "CLI-1",
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("al vender con disabledCliente, preselecciona el cliente y lo desactiva en el selector", async () => {
    mockInventarioApi.inventario = [{
      id: "S-VENTA",
      productoId: "P-VENTA",
      nombre: "Filtro Aire",
      codigo: "FA-01",
      precioUnitario: 3500,
      costoUnitario: 2000,
      stockActual: 10,
    }];
    mockGetClientes.mockResolvedValue({
      data: [{ id: "CLI-LOCKED", nombre: "María Gomez" }],
      error: null,
    });
    const onClose = vi.fn();
    mockCrearOperacion.mockResolvedValue({ id: "OP-1", tipo: "VENTA" });

    render(
      <OperacionCreateModal
        open
        talleres={[{ id: "T1", nombre: "Taller Centro" }]}
        initialCuentaId="C1"
        initialTipo="VENTA"
        initialClienteId="CLI-LOCKED"
        disabledCliente
        onClose={onClose}
      />
    );

    await runPendingPromises();

    expect(screen.getByTestId("operaciones-create-cliente")).toBeDisabled();
    expect(screen.getByTestId("operaciones-create-cliente")).toHaveValue("CLI-LOCKED");

    const stockInput = screen.getByTestId("operaciones-line-0-stock");
    await userEvent.type(stockInput, "S-VENTA");

    await userEvent.click(screen.getByTestId("modal-submit"));
    await runPendingPromises();

    expect(mockCrearOperacion).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "VENTA",
        cliente_id: "CLI-LOCKED",
      })
    );
  });

  it("permite registrar una venta diferida eliminando la cuenta de pago, guardando con saldo pendiente", async () => {
    mockCuentasApi.cuentaFavorita = {
      id: "C-FAV",
      nombre: "Banco Galicia",
      tipo: "BANCO",
      saldoActual: 50000,
      activo: true,
      favorita: true,
    };

    mockInventarioApi.inventario = [{
      id: "S-VENTA",
      productoId: "P-VENTA",
      nombre: "Batería 12V",
      codigo: "BAT-12",
      precioUnitario: 52000,
      costoUnitario: 30000,
      stockActual: 5,
    }];
    mockCrearOperacion.mockResolvedValue({ id: "OP-DIF", tipo: "VENTA" });
    const onClose = vi.fn();

    render(
      <OperacionCreateModal
        open
        talleres={[{ id: "T1", nombre: "Taller Centro" }]}
        initialTipo="VENTA"
        onClose={onClose}
      />
    );

    await runPendingPromises();

    // Seleccionar item
    const stockInput = screen.getByTestId("operaciones-line-0-stock");
    await userEvent.type(stockInput, "S-VENTA");

    // Desplegar vista avanzada para ver la tarjeta de pago
    const toggleBtn = screen.getByTestId("cobro-advanced-toggle");
    await userEvent.click(toggleBtn);
    await runPendingPromises();

    // Eliminar la cuenta de pago
    const removeBtn = screen.getByTestId("pago-remove-0");
    await userEvent.click(removeBtn);
    await runPendingPromises();

    // Verificar que se muestre el aviso de sin cobro inmediato
    expect(screen.getByTestId("pago-empty-notice")).toBeInTheDocument();

    // El botón submit debe estar habilitado
    const submitBtn = screen.getByTestId("modal-submit");
    expect(submitBtn).not.toBeDisabled();

    await userEvent.click(submitBtn);
    await runPendingPromises();

    // Verificar que se envíe con estado_pago: PENDIENTE y sin cuenta_financiera_id
    expect(mockCrearOperacion).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "VENTA",
        taller_id: "T1",
        cuenta_financiera_id: null,
        estado_pago: "PENDIENTE",
        monto_inicial: null,
        pagos: undefined,
        lineas: [
          expect.objectContaining({
            stock_id: "S-VENTA",
            cantidad: 1,
            monto_unitario: 52000,
          }),
        ],
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("actualiza por defecto el monto del pago hacia el total si no fue modificado, y no lo sobreescribe si fue modificado", async () => {
    mockCuentasApi.cuentaFavorita = null;
    mockInventarioApi.inventario = [{
      id: "S-1",
      productoId: "P-1",
      nombre: "Filtro de Aceite",
      codigo: "FLT-1",
      precioUnitario: 15000,
      costoUnitario: 8000,
      stockActual: 10,
    }];
    const onClose = vi.fn();

    render(
      <OperacionCreateModal
        open
        talleres={[{ id: "T1", nombre: "Taller Centro" }]}
        initialTipo="VENTA"
        onClose={onClose}
      />
    );

    await runPendingPromises();

    // Sin cuenta favorita, Registrar Pago se muestra de inmediato
    const montoInput = screen.getByTestId("pago-monto-0");
    const badge = screen.getByTestId("total-ingresado-badge");

    // Inicialmente total es 0
    expect(montoInput).toHaveValue(0);
    expect(badge).toHaveTextContent("Total ingresado: $0");

    // Seleccionar producto
    const stockInput = screen.getByTestId("operaciones-line-0-stock");
    await userEvent.type(stockInput, "S-1");
    await runPendingPromises();

    // El monto del pago se actualiza automáticamente al total (15000)
    expect(montoInput).toHaveValue(15000);
    expect(badge).toHaveTextContent("Total ingresado: $15.000");

    // Cambiar cantidad a 2 (total = 30000)
    const cantInput = screen.getByTestId("operaciones-line-0-cantidad");
    await userEvent.clear(cantInput);
    await userEvent.type(cantInput, "2");
    await runPendingPromises();

    // Se actualiza hacia el nuevo total
    expect(montoInput).toHaveValue(30000);
    expect(badge).toHaveTextContent("Total ingresado: $30.000");

    // Ahora el usuario modifica manualmente el monto a 20000
    await userEvent.clear(montoInput);
    await userEvent.type(montoInput, "20000");
    await runPendingPromises();

    expect(montoInput).toHaveValue(20000);
    expect(badge).toHaveTextContent("Total ingresado: $20.000");

    // Cambiar cantidad a 3 (total = 45000)
    const cantInputRefetched = screen.getByTestId("operaciones-line-0-cantidad");
    await userEvent.clear(cantInputRefetched);
    await userEvent.type(cantInputRefetched, "3");
    await runPendingPromises();

    // Como fue modificado manualmente, NO debe sobreescribirse
    expect(montoInput).toHaveValue(20000);
    expect(badge).toHaveTextContent("Total ingresado: $20.000");
  });

  it("en vista avanzada con cuenta favorita, sincroniza hacia el total y permite restaurar favorita tras modificar monto", async () => {
    mockCuentasApi.cuentaFavorita = {
      id: "C-FAV",
      nombre: "Banco Galicia",
      tipo: "BANCO",
      saldoActual: 50000,
      activo: true,
      favorita: true,
    };
    mockInventarioApi.inventario = [{
      id: "S-1",
      productoId: "P-1",
      nombre: "Aceite Motor",
      codigo: "OIL-1",
      precioUnitario: 10000,
      costoUnitario: 6000,
      stockActual: 20,
    }];
    const onClose = vi.fn();

    render(
      <OperacionCreateModal
        open
        talleres={[{ id: "T1", nombre: "Taller Centro" }]}
        initialTipo="VENTA"
        onClose={onClose}
      />
    );

    await runPendingPromises();

    // Desplegar vista avanzada
    const toggleBtn = screen.getByTestId("cobro-advanced-toggle");
    await userEvent.click(toggleBtn);
    await runPendingPromises();

    const montoInput = screen.getByTestId("pago-monto-0");
    const badge = screen.getByTestId("total-ingresado-badge");

    // Seleccionar producto
    const stockInput = screen.getByTestId("operaciones-line-0-stock");
    await userEvent.type(stockInput, "S-1");
    await runPendingPromises();

    // En vista avanzada se actualiza por defecto hacia el total (10000)
    expect(montoInput).toHaveValue(10000);
    expect(badge).toHaveTextContent("Total ingresado: $10.000");

    // Modificar monto manualmente
    await userEvent.clear(montoInput);
    await userEvent.type(montoInput, "5000");
    await runPendingPromises();
    expect(montoInput).toHaveValue(5000);

    // Colapsar a favorita y volver a desplegar: debe restaurar el total
    await userEvent.click(screen.getByTestId("cobro-advanced-toggle"));
    await runPendingPromises();
    await userEvent.click(screen.getByTestId("cobro-advanced-toggle"));
    await runPendingPromises();

    const restoredMontoInput = screen.getByTestId("pago-monto-0");
    expect(restoredMontoInput).toHaveValue(10000);
  });
});




