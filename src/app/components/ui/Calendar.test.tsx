import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Calendar from "./Calendar";

describe("Calendar UI Component", () => {
  it("renderiza el trigger por defecto y muestra la fecha seleccionada", () => {
    render(<Calendar value="2026-09-15" onChange={vi.fn()} />);

    expect(screen.getByText("2026-09-15")).toBeInTheDocument();
  });

  it("abre el calendario al hacer clic en el trigger y muestra el mes y año", async () => {
    render(<Calendar value="2026-09-15" onChange={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: /2026-09-15/i });
    await userEvent.click(trigger);

    expect(screen.getByRole("dialog", { name: "Selector de fecha" })).toBeInTheDocument();
    expect(screen.getByText("Septiembre 2026")).toBeInTheDocument();
  });

  it("permite seleccionar un día y emite la fecha en formato YYYY-MM-DD", async () => {
    const onChange = vi.fn();
    render(<Calendar value="2026-09-15" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: /2026-09-15/i }));

    const dayButton = screen.getByRole("button", { name: "20 de Septiembre" });
    await userEvent.click(dayButton);

    expect(onChange).toHaveBeenCalledWith("2026-09-20");
    // Al seleccionar en modo popover, el diálogo se cierra
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("permite navegar al mes anterior y siguiente", async () => {
    render(<Calendar value="2026-09-15" onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /2026-09-15/i }));
    expect(screen.getByText("Septiembre 2026")).toBeInTheDocument();

    const prevButton = screen.getByRole("button", { name: "Mes anterior" });
    await userEvent.click(prevButton);
    expect(screen.getByText("Agosto 2026")).toBeInTheDocument();

    const nextButton = screen.getByRole("button", { name: "Mes siguiente" });
    await userEvent.click(nextButton);
    expect(screen.getByText("Septiembre 2026")).toBeInTheDocument();
  });

  it("soporta trigger personalizado vía children", async () => {
    const onChange = vi.fn();
    render(
      <Calendar value="2026-09-15" onChange={onChange}>
        <button type="button">Mi Píldora de Fecha</button>
      </Calendar>
    );

    const customTrigger = screen.getByText("Mi Píldora de Fecha");
    await userEvent.click(customTrigger);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("soporta dataTestId personalizado", () => {
    render(<Calendar value="2026-09-15" onChange={vi.fn()} dataTestId="test-calendar" />);

    expect(screen.getByTestId("test-calendar")).toBeInTheDocument();
  });

  it("permite seleccionar el botón 'Hoy'", async () => {
    const onChange = vi.fn();
    render(<Calendar value="2026-01-01" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: /2026-01-01/i }));

    const todayButton = screen.getByRole("button", { name: "Hoy" });
    await userEvent.click(todayButton);

    expect(onChange).toHaveBeenCalledTimes(1);
    const calledDate = onChange.mock.calls[0][0];
    expect(calledDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("muestra el placeholder personalizado cuando no hay fecha seleccionada", () => {
    render(<Calendar value="" onChange={vi.fn()} placeholder="Elige un día" />);

    expect(screen.getByText("Elige un día")).toBeInTheDocument();
  });

  it("no abre el calendario cuando está deshabilitado", async () => {
    render(<Calendar value="2026-09-15" onChange={vi.fn()} disabled />);

    const trigger = screen.getByRole("button", { name: /2026-09-15/i });
    expect(trigger).toBeDisabled();
    await userEvent.click(trigger);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("permite cambiar de mes directamente desde la grilla de meses", async () => {
    render(<Calendar value="2026-09-15" onChange={vi.fn()} />);

    // Abrir popover
    await userEvent.click(screen.getByRole("button", { name: /2026-09-15/i }));
    expect(screen.getByText("Septiembre 2026")).toBeInTheDocument();

    // Clic en el selector de mes
    const monthSelectBtn = screen.getByRole("button", { name: "Seleccionar mes" });
    await userEvent.click(monthSelectBtn);

    // Debe mostrar la grilla de meses con los 12 meses
    const mayoBtn = screen.getByRole("button", { name: "Mayo" });
    expect(mayoBtn).toBeInTheDocument();

    // Seleccionar Mayo
    await userEvent.click(mayoBtn);

    // Debe volver a la vista de días con Mayo 2026
    expect(screen.getByText("Mayo 2026")).toBeInTheDocument();
  });

  it("permite cambiar de año navegando bloques de años y seleccionar una fecha completa", async () => {
    const onChange = vi.fn();
    render(<Calendar value="2026-09-15" onChange={onChange} />);

    // Abrir popover
    await userEvent.click(screen.getByRole("button", { name: /2026-09-15/i }));

    // Clic en el selector de año
    const yearSelectBtn = screen.getByRole("button", { name: "Seleccionar año" });
    await userEvent.click(yearSelectBtn);

    // Debe mostrar el rango de años
    expect(screen.getByText("2016 – 2027")).toBeInTheDocument();

    // Navegar a la página anterior de años (2004 – 2015)
    const prevYearsBtn = screen.getByRole("button", { name: "Años anteriores" });
    await userEvent.click(prevYearsBtn);
    expect(screen.getByText("2004 – 2015")).toBeInTheDocument();

    // Navegar una página más atrás (1992 – 2003)
    await userEvent.click(prevYearsBtn);
    expect(screen.getByText("1992 – 2003")).toBeInTheDocument();

    // Seleccionar el año 1995
    const year1995Btn = screen.getByRole("button", { name: "1995" });
    await userEvent.click(year1995Btn);

    // Pasa automáticamente a la vista de meses para 1995
    const marzoBtn = screen.getByRole("button", { name: "Marzo" });
    expect(marzoBtn).toBeInTheDocument();

    // Seleccionar Marzo
    await userEvent.click(marzoBtn);

    // Vuelve a la vista de días de Marzo 1995
    expect(screen.getByText("Marzo 1995")).toBeInTheDocument();

    // Seleccionar el día 10 de Marzo
    const day10Btn = screen.getByRole("button", { name: "10 de Marzo" });
    await userEvent.click(day10Btn);

    // Emite la fecha 1995-03-10
    expect(onChange).toHaveBeenCalledWith("1995-03-10");
  });

  it("permite volver a la vista de días usando el botón 'Volver a días'", async () => {
    render(<Calendar value="2026-09-15" onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /2026-09-15/i }));

    // Ir a la vista de meses
    await userEvent.click(screen.getByRole("button", { name: "Seleccionar mes" }));
    expect(screen.getByRole("button", { name: "Volver a días" })).toBeInTheDocument();

    // Clic en 'Volver a días'
    await userEvent.click(screen.getByRole("button", { name: "Volver a días" }));

    // Comprobar que regresó a la vista de días
    expect(screen.getByText("Septiembre 2026")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Volver a días" })).not.toBeInTheDocument();
  });
});
