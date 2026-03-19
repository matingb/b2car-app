import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ArregloEstadoBadge, {
  getArregloEstadoMeta,
  getArregloEstadoProgress,
} from "./ArregloEstadoBadge";
import { COLOR } from "@/theme/theme";
import type { EstadoArreglo } from "@/model/types";

describe("getArregloEstadoMeta", () => {
  it("mapea cada estado conocido a colores semanticos esperados", () => {
    const cases: Array<{
      estado: EstadoArreglo;
      dotColor: string;
      bgColor: string;
    }> = [
      {
        estado: "PRESUPUESTO",
        dotColor: COLOR.SEMANTIC.WARNING,
        bgColor: COLOR.BACKGROUND.WARNING_TINT,
      },
      {
        estado: "SIN_INICIAR",
        dotColor: COLOR.SEMANTIC.DISABLED,
        bgColor: COLOR.BACKGROUND.DISABLED_TINT,
      },
      {
        estado: "EN_PROGRESO",
        dotColor: COLOR.SEMANTIC.INFO,
        bgColor: COLOR.BACKGROUND.INFO_TINT,
      },
      {
        estado: "ESPERA",
        dotColor: COLOR.SEMANTIC.ALERT,
        bgColor: COLOR.BACKGROUND.ALERT_TINT,
      },
      {
        estado: "TERMINADO",
        dotColor: COLOR.SEMANTIC.SUCCESS,
        bgColor: COLOR.BACKGROUND.SUCCESS_TINT,
      },
    ];

    for (const { estado, dotColor, bgColor } of cases) {
      const meta = getArregloEstadoMeta(estado);
      expect(meta.label).toBe(estado.replaceAll("_", " "));
      expect(meta.dotColor).toBe(dotColor);
      expect(meta.bgColor).toBe(bgColor);
    }
  });

  it("si estado es undefined, usa SIN_INICIAR por defecto", () => {
    const meta = getArregloEstadoMeta(undefined);

    expect(meta.label).toBe("SIN INICIAR");
    expect(meta.dotColor).toBe(COLOR.SEMANTIC.DISABLED);
    expect(meta.bgColor).toBe(COLOR.BACKGROUND.DISABLED_TINT);
  });

  it("si recibe un estado no contemplado, mantiene label y cae al estilo INFO", () => {
    const meta = getArregloEstadoMeta("PAUSADO" as EstadoArreglo);

    expect(meta.label).toBe("PAUSADO");
    expect(meta.dotColor).toBe(COLOR.SEMANTIC.INFO);
    expect(meta.bgColor).toBe(COLOR.BACKGROUND.INFO_TINT);
  });
});

describe("ArregloEstadoBadge", () => {
  it("expone un progreso por defecto segun el estado", () => {
    expect(getArregloEstadoProgress("PRESUPUESTO")).toBe(0);
    expect(getArregloEstadoProgress("SIN_INICIAR")).toBe(10);
  });

  it("renderiza el label transformado con espacios", () => {
    render(<ArregloEstadoBadge estado="EN_PROGRESO" />);

    expect(screen.getByText("EN PROGRESO")).toBeInTheDocument();
  });

  it("renderiza SIN INICIAR cuando no se pasa estado", () => {
    render(<ArregloEstadoBadge />);

    expect(screen.getByText("SIN INICIAR")).toBeInTheDocument();
  });

  it("si recibe progress, usa ese valor para el llenado radial", () => {
    render(<ArregloEstadoBadge estado="EN_PROGRESO" progress={25} />);

    const progressCircle = screen.getByTestId("arreglo-estado-progress");
    const radialFill = progressCircle.firstElementChild as HTMLElement;

    expect(radialFill).toHaveStyle({
      background: `conic-gradient(${COLOR.SEMANTIC.INFO} 0deg 90deg, ${COLOR.BACKGROUND.INFO_TINT} 90deg 360deg)`,
    });
  });

  it("si recibe onStateChange, abre un dropdown y permite elegir otro estado", () => {
    const onStateChange = vi.fn();

    render(<ArregloEstadoBadge estado="EN_PROGRESO" onStateChange={onStateChange} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Cambiar estado de arreglo. Estado actual: EN PROGRESO",
      })
    );

    expect(
      screen.getByRole("listbox", { name: "Opciones de estado de arreglo" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: "TERMINADO" }));

    expect(onStateChange).toHaveBeenCalledWith("TERMINADO");
    expect(
      screen.queryByRole("listbox", { name: "Opciones de estado de arreglo" })
    ).not.toBeInTheDocument();
  });
});
