import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RepuestoLineasEditableSection from "./RepuestoLineasEditableSection";
import type { RepuestoLinea } from "./RepuestoLineasEditableSection";
import { useInventario } from "@/app/providers/InventarioProvider";

vi.mock("@/app/providers/InventarioProvider", () => ({
  useInventario: vi.fn(),
}));

vi.mock("@/app/components/ui/Autocomplete", () => ({
  __esModule: true,
  default: ({
    value,
    onChange,
    placeholder,
    disabled,
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
  }) => (
    <input
      data-testid="stock-autocomplete"
      value={value}
      placeholder={placeholder}
      disabled={disabled ?? false}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const inventario = [
  {
    id: "s1",
    productoId: "p1",
    tallerId: "taller-1",
    nombre: "Filtro de aceite",
    codigo: "FIL-001",
    categorias: [],
    stockActual: 10,
    stockMinimo: 0,
    stockMaximo: 0,
    costoUnitario: 800,
    precioUnitario: 1500,
    proveedor: "",
    ubicacion: "",
    showInStock: true,
    ultimaActualizacion: "",
    historialMovimientos: [],
  },
  {
    id: "s2",
    productoId: "p2",
    tallerId: "taller-1",
    nombre: "Bujía NGK",
    codigo: "BUJ-002",
    categorias: [],
    stockActual: 2,
    stockMinimo: 0,
    stockMaximo: 0,
    costoUnitario: 300,
    precioUnitario: 500,
    proveedor: "",
    ubicacion: "",
    showInStock: true,
    ultimaActualizacion: "",
    historialMovimientos: [],
  },
];

function setup(overrides: Partial<Parameters<typeof RepuestoLineasEditableSection>[0]> = {}) {
  vi.mocked(useInventario).mockReturnValue({
    inventario,
    isLoading: false,
  } as unknown as ReturnType<typeof useInventario>);

  const onUpsert = vi.fn();
  const onDelete = vi.fn();

  const result = render(
    <RepuestoLineasEditableSection
      tallerId="taller-1"
      items={[]}
      onUpsert={onUpsert}
      onDelete={onDelete}
      {...overrides}
    />
  );

  return { onUpsert, onDelete, ...result };
}

function startNewProduct() {
  fireEvent.click(screen.getByRole("button", { name: /agregar repuesto/i }));
  fireEvent.change(screen.getByTestId("stock-autocomplete"), {
    target: { value: "__nuevo_producto__" },
  });
}

function selectStock(stockId: string) {
  fireEvent.click(screen.getByRole("button", { name: /agregar repuesto/i }));
  fireEvent.change(screen.getByTestId("stock-autocomplete"), {
    target: { value: stockId },
  });
}

describe("RepuestoLineasEditableSection", () => {
  it("muestra estado vacío y botón de agregar", () => {
    setup();
    expect(screen.getByText("Sin repuestos asignados.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /agregar repuesto/i })
    ).toBeInTheDocument();
  });

  it("crea un producto nuevo con los campos correctos", async () => {
    const { onUpsert } = setup();

    startNewProduct();
    expect(screen.getByText("Nuevo producto")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "FILT-NEW" },
    });
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Filtro nuevo" },
    });
    fireEvent.change(screen.getByLabelText("Cantidad"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("Precio compra"), {
      target: { value: "500" },
    });
    fireEvent.change(screen.getByLabelText("Precio venta"), {
      target: { value: "800" },
    });

    fireEvent.click(screen.getByRole("button", { name: "agregar repuesto" }));

    await waitFor(() => {
      expect(onUpsert).toHaveBeenCalledWith({
        tipo: "nuevo",
        codigo: "FILT-NEW",
        nombre: "Filtro nuevo",
        precio_compra: 500,
        precio_venta: 800,
        cantidad: 3,
        monto_unitario: 800,
      });
    });
  });

  it("precarga codigo AL al crear un producto nuevo", () => {
    setup();

    startNewProduct();

    expect(screen.getByDisplayValue("AL1")).toBeInTheDocument();
  });

  it("auto-sincroniza precio venta con precio compra hasta que el usuario lo modifique", () => {
    setup();
    startNewProduct();

    fireEvent.change(screen.getByLabelText("Precio compra"), {
      target: { value: "500" },
    });
    expect(screen.getByLabelText("Precio venta")).toHaveValue("500");

    fireEvent.change(screen.getByLabelText("Precio venta"), {
      target: { value: "800" },
    });
    fireEvent.change(screen.getByLabelText("Precio compra"), {
      target: { value: "600" },
    });
    expect(screen.getByLabelText("Precio venta")).toHaveValue("800");
  });

  it("muestra warning por código duplicado en inventario", () => {
    setup();
    startNewProduct();

    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "FIL-001" },
    });

    expect(
      screen.getByText(
        "Ya existe un producto con ese código. Seleccionalo desde el listado."
      )
    ).toBeInTheDocument();
  });

  it("muestra warning por código duplicado contra otro item nuevo del arreglo", () => {
    const existingNewItem: RepuestoLinea = {
      id: "rep-1",
      stock_id: "__nuevo_producto__",
      tipo: "nuevo",
      cantidad: 1,
      monto_unitario: 100,
      nuevoProducto: {
        codigo: "ABC-123",
        nombre: "Producto existente",
        precioCompra: 50,
        precioVenta: 100,
      },
    };
    setup({ items: [existingNewItem] });
    startNewProduct();

    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "ABC-123" },
    });

    expect(
      screen.getByText("Este producto ya fue cargado en este arreglo")
    ).toBeInTheDocument();
  });

  it("muestra hint de compra cuando el stock es insuficiente", () => {
    setup();
    selectStock("s2");

    fireEvent.change(screen.getByLabelText("Cantidad"), {
      target: { value: "5" },
    });

    expect(screen.getByText(/Se comprarán 3 unidades/)).toBeInTheDocument();
    expect(screen.getByText(/Stock disponible: 2/)).toBeInTheDocument();
  });

  it("no muestra hint de compra cuando el stock alcanza", () => {
    setup();
    selectStock("s1");

    fireEvent.change(screen.getByLabelText("Cantidad"), {
      target: { value: "3" },
    });

    expect(screen.queryByText(/Se comprarán/)).not.toBeInTheDocument();
  });

  it("deshabilita el botón agregar si no hay taller", () => {
    setup({ tallerId: null });

    expect(
      screen.getByRole("button", { name: /agregar repuesto/i })
    ).toBeDisabled();
  });

  it("muestra hint de compra al crear un producto nuevo con cantidad válida", () => {
    setup();
    startNewProduct();

    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "NEW-001" },
    });
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Producto nuevo" },
    });
    fireEvent.change(screen.getByLabelText("Cantidad"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("Precio compra"), {
      target: { value: "1000" },
    });

    expect(screen.getByText(/Se comprarán 5 unidades/)).toBeInTheDocument();
    expect(screen.getByText(/Stock disponible: 0/)).toBeInTheDocument();
  });

  it("no muestra hint de compra para producto nuevo cuando hay conflicto de código", () => {
    setup();
    startNewProduct();

    fireEvent.change(screen.getByLabelText("Cantidad"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("Precio compra"), {
      target: { value: "500" },
    });
    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "FIL-001" },
    });

    expect(
      screen.getByText("Ya existe un producto con ese código. Seleccionalo desde el listado.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/Se comprarán/)).not.toBeInTheDocument();
  });

  it("conflicto de código duplicado en items tiene prioridad sobre hint de compra", () => {
    const existingNewItem: RepuestoLinea = {
      id: "rep-1",
      stock_id: "__nuevo_producto__",
      tipo: "nuevo",
      cantidad: 1,
      monto_unitario: 100,
      nuevoProducto: {
        codigo: "DUP-001",
        nombre: "Producto dup",
        precioCompra: 50,
        precioVenta: 100,
      },
    };
    setup({ items: [existingNewItem] });
    startNewProduct();

    fireEvent.change(screen.getByLabelText("Cantidad"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("Precio compra"), {
      target: { value: "500" },
    });
    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "DUP-001" },
    });

    expect(
      screen.getByText("Este producto ya fue cargado en este arreglo")
    ).toBeInTheDocument();
    expect(screen.queryByText(/Se comprarán/)).not.toBeInTheDocument();
  });

  it("muestra warning de repuesto duplicado al seleccionar stock ya existente en el arreglo", () => {
    const existingItem: RepuestoLinea = {
      id: "rep-1",
      stock_id: "s1",
      cantidad: 2,
      monto_unitario: 1500,
    };
    setup({ items: [existingItem] });
    selectStock("s1");

    expect(
      screen.getByText("El repuesto ya se encuentra en el arreglo")
    ).toBeInTheDocument();
    expect(screen.queryByText(/Se comprarán/)).not.toBeInTheDocument();
  });

  it("conflicto de repuesto duplicado tiene prioridad sobre hint de stock insuficiente", () => {
    const existingItem: RepuestoLinea = {
      id: "rep-1",
      stock_id: "s2",
      cantidad: 1,
      monto_unitario: 500,
    };
    setup({ items: [existingItem] });
    selectStock("s2");

    fireEvent.change(screen.getByLabelText("Cantidad"), {
      target: { value: "10" },
    });

    expect(
      screen.getByText("El repuesto ya se encuentra en el arreglo")
    ).toBeInTheDocument();
    expect(screen.queryByText(/Se comprarán/)).not.toBeInTheDocument();
  });
});
