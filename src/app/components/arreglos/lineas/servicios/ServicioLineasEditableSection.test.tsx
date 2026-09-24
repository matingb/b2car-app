import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ServicioLineasEditableSection from "./ServicioLineasEditableSection";
import { TenantTestProvider, mockHasPermission } from "@/tests/testUtils";
import { UserRole } from "@/lib/permissions";

vi.mock("@/app/providers/CategoriasArregloProvider", () => ({
  useCategoriasArreglo: () => ({ categorias: [], isLoading: false }),
}));

vi.mock("@/app/providers/EmpleadosProvider", () => ({
  useEmpleados: () => ({ empleados: [], isLoading: false }),
}));

describe("ServicioLineasEditableSection", () => {
  it("oculta agregar, editar y eliminar cuando está fiscalmente bloqueado", () => {
    render(
      <TenantTestProvider>
        <ServicioLineasEditableSection
          readOnly
          items={[{
            id: "servicio-1",
            descripcion: "Cambio de aceite",
            cantidad: 1,
            precioHoraFacturada: 15000,
            horasFacturadas: 1,
            horasTrabajadas: 1,
            valorHoraEmpleado: null,
            categoriaArregloId: null,
            empleadoId: null,
          }]}
          onAdd={vi.fn()}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
        />
      </TenantTestProvider>
    );

    expect(screen.queryByRole("button", { name: /agregar mano de obra/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /editar servicio/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /eliminar servicio/i })).not.toBeInTheDocument();
  });

  it("oculta precios para rol operativo y envía valor 0 al agregar servicio", async () => {
    const onAdd = vi.fn();
    render(
      <TenantTestProvider
        hasPermission={mockHasPermission(UserRole.Operativo)}
      >
        <ServicioLineasEditableSection
          items={[{
            id: "servicio-1",
            descripcion: "Cambio de aceite",
            cantidad: 2,
            precioHoraFacturada: 15000,
            horasFacturadas: 1,
            horasTrabajadas: 1,
            valorHoraEmpleado: null,
            categoriaArregloId: null,
            empleadoId: null,
          }]}
          onAdd={onAdd}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
        />
      </TenantTestProvider>
    );

    // Subtotal and unit price should not be displayed
    expect(screen.queryByText(/Subtotal/)).not.toBeInTheDocument();
    expect(screen.queryByText(/15\.000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/30\.000/)).not.toBeInTheDocument();
    expect(screen.getByText("Horas facturadas: 1; cantidad: 2")).toBeInTheDocument();

    // Click Agregar Mano de Obra
    fireEvent.click(screen.getByRole("button", { name: /agregar mano de obra/i }));

    // Price input should not be displayed
    expect(screen.queryByLabelText("Precio venta")).not.toBeInTheDocument();

    // Fill description
    fireEvent.change(screen.getByPlaceholderText(/Cambio de aceite/i), {
      target: { value: "Alineación y balanceo" },
    });

    // Confirm
    fireEvent.click(screen.getByRole("button", { name: "agregar servicio" }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith({
        descripcion: "Alineación y balanceo",
        cantidad: 1,
        horasFacturadas: 1,
        horasTrabajadas: 1,
        valorHoraEmpleado: null,
        precioHoraFacturada: 0,
        categoriaArregloId: null,
        empleadoId: null,
      });
    });
  });

  it("precarga el precio con el valor_hora del taller activo al abrir el formulario", () => {
    render(
      <TenantTestProvider
        talleres={[
          {
            id: "tal-1",
            nombre: "Taller Norte",
            ubicacion: "Av. Cabildo 100",
            valor_hora: 16500,
          },
        ]}
        tallerSeleccionadoId="tal-1"
      >
        <ServicioLineasEditableSection
          items={[]}
          onAdd={vi.fn()}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
        />
      </TenantTestProvider>
    );

    // Al inicio no se edita nada
    expect(screen.queryByLabelText("Precio venta")).not.toBeInTheDocument();

    // Abrir formulario
    fireEvent.click(screen.getByRole("button", { name: /agregar mano de obra/i }));

    // El input de precio de venta debe tener precargado 16500
    const priceInput = screen.getByLabelText("Precio venta");
    expect(priceInput).toHaveValue(16500);
  });
});
