import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import EmpleadoSelect from "./EmpleadoSelect";

vi.mock("@/app/providers/EmpleadosProvider", () => ({
  useEmpleados: () => ({
    empleados: [
      {
        id: "emp-1",
        tallerId: "taller-1",
        nombre: "Juan",
        apellido: "Pérez",
        salario: 15000,
        valorHora: 8500,
        email: "juan@example.com",
        tenant_id: "ten-1",
        rol: "MECANICO",
      },
      {
        id: "emp-2",
        tallerId: "taller-1",
        nombre: "María",
        apellido: "Gómez",
        salario: 0,
        valorHora: 0,
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

vi.mock("@/app/providers/TenantProvider", () => ({
  useTenant: () => ({ tallerSeleccionadoId: null }),
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
    render(<EmpleadoSelect value="emp-1" onChange={vi.fn()} showMontoHoras={true} canViewHourlyRate hourlyRate={8500} />);

    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByText(/8\.500\/h/)).toBeInTheDocument();
    expect(screen.getByText("JP")).toBeInTheDocument();
  });

  it("muestra el valor hora maestro configurado, incluso si es cero", () => {
    render(
      <EmpleadoSelect
        value="emp-2"
        onChange={vi.fn()}
        showMontoHoras={true}
        canViewHourlyRate
      />
    );

    expect(screen.getByText("María Gómez")).toBeInTheDocument();
    expect(screen.getByText(/0\/h/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /empleado María Gómez/i }));
    expect(screen.getByLabelText("Valor hora ($/h):")).toHaveValue(0);
    const popover = document.getElementById("employee-select-popover");
    expect(popover).not.toBeNull();
    expect(within(popover as HTMLElement).getByText("MG")).toBeInTheDocument();
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
        canViewHourlyRate
        canEditHourlyRate
        onChangeHourlyRate={onChangeHourlyRate}
      />
    );

    // Abrir popover
    fireEvent.click(screen.getByRole("button", { name: /empleado Juan Pérez/i }));

    // Input de valor hora
    const rateInput = screen.getByLabelText("Valor hora ($/h):");
    expect(rateInput).toHaveValue(8500);

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

  it("muestra el costo al usuario con permiso de lectura sin permitir editarlo ni guardar un snapshot solo por confirmar", () => {
    const onChangeHourlyRate = vi.fn();

    render(
      <EmpleadoSelect
        value="emp-1"
        onChange={vi.fn()}
        showMontoHoras
        canViewHourlyRate
        onChangeHourlyRate={onChangeHourlyRate}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /empleado Juan Pérez/i }));
    const rateInput = screen.getByLabelText("Valor hora ($/h):");
    expect(rateInput).toHaveValue(8500);
    expect(rateInput).toHaveAttribute("readonly");

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onChangeHourlyRate).not.toHaveBeenCalled();
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

  it("al seleccionar un empleado, setea su valor hora definido como costo hora", () => {
    const onChange = vi.fn();
    const onChangeHourlyRate = vi.fn();

    render(
      <EmpleadoSelect
        value={null}
        onChange={onChange}
        showMontoHoras={true}
        canViewHourlyRate
        canEditHourlyRate
        onChangeHourlyRate={onChangeHourlyRate}
      />
    );

    // Abrir popover
    fireEvent.click(screen.getByRole("button", { name: "+ Empleado" }));

    // Input inicialmente en 0
    const rateInput = screen.getByLabelText("Valor hora ($/h):");
    expect(rateInput).toHaveValue(0);

    // Seleccionar a Juan Pérez (valorHora = 8500)
    fireEvent.click(screen.getByText("Juan Pérez"));

    // El input debe haberse actualizado al valor definido para Juan Pérez
    expect(rateInput).toHaveValue(8500);

    // Confirmar
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(onChange).toHaveBeenCalledWith("emp-1");
    expect(onChangeHourlyRate).toHaveBeenCalledWith(8500);
  });

  it("al cambiar de empleado con una tarifa existente, setea el valor hora del nuevo empleado", () => {
    const onChange = vi.fn();
    const onChangeHourlyRate = vi.fn();

    render(
      <EmpleadoSelect
        value="emp-1"
        hourlyRate={8500}
        onChange={onChange}
        showMontoHoras={true}
        canViewHourlyRate
        canEditHourlyRate
        onChangeHourlyRate={onChangeHourlyRate}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /empleado Juan Pérez/i }));

    const rateInput = screen.getByLabelText("Valor hora ($/h):");
    expect(rateInput).toHaveValue(8500);

    // Seleccionar a María Gómez (valorHora = 0)
    fireEvent.click(screen.getByText("María Gómez"));

    // Debe actualizarse a 0 (el valor hora definido de María)
    expect(rateInput).toHaveValue(0);

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(onChange).toHaveBeenCalledWith("emp-2");
    expect(onChangeHourlyRate).toHaveBeenCalledWith(0);
  });

  it("al desasignar empleado con showMontoHoras, limpia el valor hora enviando null", () => {
    const onChange = vi.fn();
    const onChangeHourlyRate = vi.fn();

    render(
      <EmpleadoSelect
        value="emp-1"
        hourlyRate={8500}
        onChange={onChange}
        showMontoHoras={true}
        canViewHourlyRate
        canEditHourlyRate
        onChangeHourlyRate={onChangeHourlyRate}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /empleado Juan Pérez/i }));
    fireEvent.click(screen.getByText("Sin asignar"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(onChange).toHaveBeenCalledWith(null);
    expect(onChangeHourlyRate).toHaveBeenCalledWith(null);
  });
});
