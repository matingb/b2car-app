import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ServicioLineasEditableSection from "./ServicioLineasEditableSection";
import { TenantTestProvider } from "@/app/providers/TenantProvider";
import { hasPermission, UserRole } from "@/lib/permissions";

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
            valor: 15000,
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
        hasPermission={(p) => hasPermission(UserRole.Operativo, p)}
      >
        <ServicioLineasEditableSection
          items={[{
            id: "servicio-1",
            descripcion: "Cambio de aceite",
            cantidad: 2,
            valor: 15000,
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
    expect(screen.getByText("Cantidad: 2")).toBeInTheDocument();

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
        valor: 0,
        categoriaArregloId: null,
        empleadoId: null,
      });
    });
  });
});
