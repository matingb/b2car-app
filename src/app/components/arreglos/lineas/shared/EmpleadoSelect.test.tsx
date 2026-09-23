import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EmpleadoSelect from "./EmpleadoSelect";

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
      {
        id: "emp-2",
        nombre: "María",
        apellido: "Gómez",
        salario: 0,
        email: "maria@example.com",
        tenant_id: "ten-1",
        rol: "MECANICO",
      },
    ],
    isLoading: false,
  }),
  getEmpleadoColor: () => ({
    bg: "#e0f2fe",
    border: "#bae6fd",
    text: "#0369a1",
    avatarBg: "#0284c7",
    avatarText: "#ffffff",
  }),
}));

describe("EmpleadoSelect", () => {
  it("muestra placeholder '+ Empleado' cuando no hay selección", () => {
    render(<EmpleadoSelect value={null} onChange={vi.fn()} />);

    expect(screen.getByText("+ Empleado")).toBeInTheDocument();
  });

  it("muestra nombre sin monto de horas cuando showMontoHoras es falso (modo Repuestos)", () => {
    render(<EmpleadoSelect value="emp-1" onChange={vi.fn()} showMontoHoras={false} />);

    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.queryByText(/15\.000/)).not.toBeInTheDocument();
    expect(screen.getByText("JP")).toBeInTheDocument();
  });

  it("muestra nombre con monto de horas cuando showMontoHoras es true (modo Mano de obra)", () => {
    render(<EmpleadoSelect value="emp-1" onChange={vi.fn()} showMontoHoras={true} />);

    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByText(/15\.000\/h/)).toBeInTheDocument();
    expect(screen.getByText("JP")).toBeInTheDocument();
  });

  it("utiliza defaultHourlyRate cuando el empleado no tiene salario específico y showMontoHoras es true", () => {
    render(
      <EmpleadoSelect
        value="emp-2"
        onChange={vi.fn()}
        showMontoHoras={true}
        defaultHourlyRate={18000}
      />
    );

    expect(screen.getByText("María Gómez")).toBeInTheDocument();
    expect(screen.getByText(/18\.000\/h/)).toBeInTheDocument();
    expect(screen.getByText("MG")).toBeInTheDocument();
  });

  it("abre el popover al hacer clic en el trigger", () => {
    render(<EmpleadoSelect value={null} onChange={vi.fn()} />);

    expect(screen.queryByText("Confirmar")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+ Empleado" }));

    expect(screen.getByText("Confirmar")).toBeInTheDocument();
    expect(screen.getByText("Cancelar")).toBeInTheDocument();
    expect(screen.getByText("Sin asignar")).toBeInTheDocument();
  });

  it("permite editar el valor hora y confirmarlo llamando a onChange y onChangeHourlyRate", () => {
    const onChange = vi.fn();
    const onChangeHourlyRate = vi.fn();

    render(
      <EmpleadoSelect
        value="emp-1"
        onChange={onChange}
        showMontoHoras={true}
        onChangeHourlyRate={onChangeHourlyRate}
      />
    );

    // Abrir popover
    fireEvent.click(screen.getByRole("button", { name: /empleado Juan Pérez/i }));

    // Input de valor hora
    const rateInput = screen.getByLabelText("Valor hora ($/h):");
    expect(rateInput).toHaveValue(15000);

    // Seleccionar a María Gómez
    fireEvent.click(screen.getByText("María Gómez"));

    // Modificar valor hora
    fireEvent.change(rateInput, { target: { value: "22000" } });
    expect(rateInput).toHaveValue(22000);

    // Confirmar
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(onChange).toHaveBeenCalledWith("emp-2");
    expect(onChangeHourlyRate).toHaveBeenCalledWith(22000);
    // Popover cerrado
    expect(screen.queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument();
  });

  it("cancela cambios al hacer clic en Cancelar", () => {
    const onChange = vi.fn();

    render(<EmpleadoSelect value="emp-1" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /empleado Juan Pérez/i }));
    fireEvent.click(screen.getByText("María Gómez"));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument();
  });

  it("permite desasignar el empleado seleccionando 'Sin asignar'", () => {
    const onChange = vi.fn();

    render(<EmpleadoSelect value="emp-1" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /empleado Juan Pérez/i }));
    fireEvent.click(screen.getByText("Sin asignar"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
