import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import EmpleadoChip from "./EmpleadoChip";

vi.mock("@/app/providers/EmpleadosProvider", () => ({
  useEmpleados: () => ({
    empleados: [
      {
        id: "emp-1",
        nombre: "Juan",
        apellido: "Pérez",
        salario: 15000,
        email: "juan@example.com",
        tenant_id: "ten-1",
        rol: "MECANICO",
      },
    ],
    isLoading: false,
  }),
  getEmpleadoColor: () => ({
    bg: "#e0f2fe",
    text: "#0369a1",
    border: "#bae6fd",
    avatarBg: "#0284c7",
    avatarText: "#ffffff",
  }),
}));

describe("EmpleadoChip", () => {
  it("no renderiza nada cuando empleadoId es null", () => {
    const { container } = render(<EmpleadoChip empleadoId={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza solo el nombre cuando showMontoHoras es falso (modo Repuestos)", () => {
    render(<EmpleadoChip empleadoId="emp-1" showMontoHoras={false} />);

    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.queryByText(/15\.000/)).not.toBeInTheDocument();
    expect(screen.getByText("JP")).toBeInTheDocument();
  });

  it("renderiza nombre y monto de horas cuando showMontoHoras es true (modo Mano de obra)", () => {
    render(<EmpleadoChip empleadoId="emp-1" showMontoHoras={true} rate={15000} />);

    expect(screen.getByText("Juan Pérez · $15.000/h")).toBeInTheDocument();
    expect(screen.getByText("JP")).toBeInTheDocument();
  });

  it("no usa el salario del empleado como valor hora", () => {
    render(<EmpleadoChip empleadoId="emp-1" showMontoHoras={true} />);

    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.queryByText(/15\.000\/h/)).not.toBeInTheDocument();
  });
});
