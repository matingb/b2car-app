import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TimeDetailPopover } from "./TimeDetailPopover";

describe("TimeDetailPopover", () => {
  it("muestra el resumen de horas facturadas y trabajadas en el trigger", () => {
    render(
      <TimeDetailPopover
        billedHours={2}
        actualHours={3}
        unitPrice={10000}
        quantity={1}
        onChangeBilledHours={vi.fn()}
        onChangeActualHours={vi.fn()}
      />
    );

    expect(screen.getByText("2h")).toBeInTheDocument();
    expect(screen.getByText("3h")).toBeInTheDocument();
  });

  it("abre el popover mediante portal al hacer clic en el trigger", () => {
    render(
      <TimeDetailPopover
        billedHours={1}
        actualHours={1}
        unitPrice={15000}
        quantity={1}
        employeeHourlyRate={10000}
        onChangeBilledHours={vi.fn()}
        onChangeActualHours={vi.fn()}
      />
    );

    expect(screen.queryByText("Listo")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Fact: 1h · Trab: 1h/i }));

    expect(screen.getByText("Listo")).toBeInTheDocument();
    expect(screen.getByText("Facturada")).toBeInTheDocument();
    expect(screen.getByText("Trabajada")).toBeInTheDocument();
  });

  it("permite cambiar las horas facturadas y trabajadas", () => {
    const onChangeBilled = vi.fn();
    const onChangeActual = vi.fn();

    render(
      <TimeDetailPopover
        billedHours={1}
        actualHours={1}
        unitPrice={15000}
        quantity={1}
        employeeHourlyRate={10000}
        onChangeBilledHours={onChangeBilled}
        onChangeActualHours={onChangeActual}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Fact: 1h · Trab: 1h/i }));

    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs).toHaveLength(2);

    fireEvent.change(inputs[0], { target: { value: "2.5" } });
    expect(onChangeBilled).toHaveBeenCalledWith(2.5);

    fireEvent.change(inputs[1], { target: { value: "3" } });
    expect(onChangeActual).toHaveBeenCalledWith(3);
  });

  it("cierra el popover al hacer clic en 'Listo'", () => {
    render(
      <TimeDetailPopover
        billedHours={1}
        actualHours={1}
        unitPrice={15000}
        quantity={1}
        onChangeBilledHours={vi.fn()}
        onChangeActualHours={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Fact: 1h · Trab: 1h/i }));
    expect(screen.getByText("Listo")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Listo"));
    expect(screen.queryByText("Listo")).not.toBeInTheDocument();
  });

  it("utiliza 1 por defecto cuando billedHours y actualHours son null o undefined", () => {
    render(
      <TimeDetailPopover
        unitPrice={15000}
        quantity={1}
        onChangeBilledHours={vi.fn()}
        onChangeActualHours={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /Fact: 1h · Trab: 1h/i })).toBeInTheDocument();
  });

  it("normaliza a 0 si el usuario vacía el input y pierde el foco", () => {
    const onChangeBilled = vi.fn();
    render(
      <TimeDetailPopover
        billedHours={1}
        actualHours={1}
        unitPrice={15000}
        quantity={1}
        onChangeBilledHours={onChangeBilled}
        onChangeActualHours={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Fact: 1h · Trab: 1h/i }));
    const inputs = screen.getAllByRole("spinbutton");

    fireEvent.change(inputs[0], { target: { value: "" } });
    fireEvent.blur(inputs[0]);

    expect(onChangeBilled).toHaveBeenCalledWith(0);
  });
});
