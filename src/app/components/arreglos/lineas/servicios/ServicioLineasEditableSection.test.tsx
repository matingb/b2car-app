import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ServicioLineasEditableSection from "./ServicioLineasEditableSection";

vi.mock("@/app/providers/CategoriasArregloProvider", () => ({
  useCategoriasArreglo: () => ({ categorias: [], isLoading: false }),
}));

vi.mock("@/app/providers/EmpleadosProvider", () => ({
  useEmpleados: () => ({ empleados: [], isLoading: false }),
}));

describe("ServicioLineasEditableSection", () => {
  it("oculta agregar, editar y eliminar cuando está fiscalmente bloqueado", () => {
    render(
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
    );

    expect(screen.queryByRole("button", { name: /agregar mano de obra/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /editar servicio/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /eliminar servicio/i })).not.toBeInTheDocument();
  });
});
