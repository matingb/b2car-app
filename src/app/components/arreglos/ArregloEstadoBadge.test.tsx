import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ArregloEstadoBadge from "./ArregloEstadoBadge";
import { getArregloEstadoMeta, getArregloEstadoProgress } from "./hooks/useArregloEstado";
import { COLOR } from "@/theme/theme";
import type { EstadoArreglo } from "@/model/types";

vi.mock("@/app/providers/ArreglosProvider", () => ({
  useArreglos: () => ({
    updateArreglo: vi.fn(),
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

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
        bgColor: "transparent",
      },
      {
        estado: "SIN_INICIAR",
        dotColor: COLOR.SEMANTIC.DISABLED,
        bgColor: "transparent",
      },
      {
        estado: "EN_PROGRESO",
        dotColor: COLOR.SEMANTIC.INFO,
        bgColor: "transparent",
      },
      {
        estado: "ESPERA",
        dotColor: COLOR.SEMANTIC.ALERT,
        bgColor: "transparent",
      },
      {
        estado: "TERMINADO",
        dotColor: COLOR.SEMANTIC.SUCCESS,
        bgColor: "transparent",
      },
    ];

    for (const { estado, dotColor, bgColor } of cases) {
      const meta = getArregloEstadoMeta(estado);
      expect(meta.label.toLowerCase()).toBe(estado.replaceAll("_", " ").toLowerCase());
      expect(meta.dotColor).toBe(dotColor);
      expect(meta.bgColor).toBe(bgColor);
    }
  });

  it("si estado es undefined, usa SIN_INICIAR por defecto", () => {
    const meta = getArregloEstadoMeta(undefined);

    expect(meta.label).toBe("Sin iniciar");
    expect(meta.dotColor).toBe(COLOR.SEMANTIC.DISABLED);
    expect(meta.bgColor).toBe("transparent");
  });

  it("si recibe un estado no contemplado, mantiene label y cae al estilo INFO", () => {
    const meta = getArregloEstadoMeta("PAUSADO" as EstadoArreglo);

    expect(meta.label).toBe("Pausado");
    expect(meta.dotColor).toBe(COLOR.SEMANTIC.INFO);
    expect(meta.bgColor).toBe("transparent");
  });
});

describe("ArregloEstadoBadge", () => {
  it("expone un progreso por defecto segun el estado", () => {
    expect(getArregloEstadoProgress("PRESUPUESTO")).toBe(0);
    expect(getArregloEstadoProgress("SIN_INICIAR")).toBe(10);
  });

  it("renderiza el badge con el estado asignado", () => {
    render(<ArregloEstadoBadge estado="EN_PROGRESO" />);

    expect(screen.getByTestId("arreglo-estado-badge")).toBeInTheDocument();
  });

  it("renderiza el badge por defecto cuando no se pasa estado", () => {
    render(<ArregloEstadoBadge />);

    expect(screen.getByTestId("arreglo-estado-badge")).toBeInTheDocument();
  });

  it("si recibe progress, usa ese valor para el llenado radial", () => {
    render(<ArregloEstadoBadge estado="EN_PROGRESO" progress={25} />);

    const progressCircle = screen.getByTestId("arreglo-estado-progress");
    const radialFill = progressCircle.firstElementChild as HTMLElement;

    expect(radialFill).toHaveStyle({
      background: `conic-gradient(${COLOR.SEMANTIC.INFO} 0deg 90deg, transparent 90deg 360deg)`,
    });
  });

  it("mantiene el tab order del menú portal y restaura foco al cerrar con Escape", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <>
        <ArregloEstadoBadge estado="EN_PROGRESO" onStateChange={vi.fn()} onOpenChange={onOpenChange} />
        <button type="button" hidden data-testid="hidden-following-control">Oculto</button>
        <button type="button" data-testid="following-control">Factura pendiente</button>
      </>
    );

    const trigger = screen.getByTestId("arreglo-estado-badge");
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.tab();
    let options = screen.getAllByRole("option");
    expect(options[0]).toHaveFocus();
    await user.tab({ shift: true });
    expect(trigger).toHaveFocus();

    await user.keyboard("{Enter}");
    await user.tab();
    options = screen.getAllByRole("option");
    expect(options[0]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(options[1]).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(options[0]).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    await user.keyboard("{Enter}");
    await user.tab();
    options = screen.getAllByRole("option");
    for (const option of options) {
      expect(option).toHaveFocus();
      if (option !== options.at(-1)) await user.tab();
    }
    await user.tab();
    expect(screen.getByTestId("hidden-following-control")).not.toHaveFocus();
    expect(screen.getByTestId("following-control")).toHaveFocus();
  });

  it("permite desplazarse por las opciones cuando la altura disponible es reducida", () => {
    const originalInnerHeight = Object.getOwnPropertyDescriptor(window, "innerHeight");
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 220 });
    try {
      render(<ArregloEstadoBadge estado="EN_PROGRESO" onStateChange={vi.fn()} />);
      const trigger = screen.getByTestId("arreglo-estado-badge");
      Object.defineProperty(trigger.parentElement, "getBoundingClientRect", {
        configurable: true,
        value: () => ({ x: 20, y: 94, top: 94, right: 150, bottom: 120, left: 20, width: 130, height: 26, toJSON: () => ({}) }),
      });
      fireEvent.click(trigger);
      const listbox = screen.getByRole("listbox");
      expect(listbox).toHaveStyle({ maxHeight: "92px", overflowY: "auto" });
      expect(screen.getAllByRole("option")).toHaveLength(4);
    } finally {
      if (originalInnerHeight) Object.defineProperty(window, "innerHeight", originalInnerHeight);
    }
  });

  it("si recibe onStateChange, abre un dropdown y permite elegir otro estado", () => {
    const onStateChange = vi.fn();

    render(<ArregloEstadoBadge estado="EN_PROGRESO" onStateChange={onStateChange} />);

    fireEvent.click(screen.getByTestId("arreglo-estado-badge"));

    expect(
      screen.getByRole("listbox", { name: "Opciones de estado de arreglo" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("arreglo-estado-option-TERMINADO"));

    expect(onStateChange).toHaveBeenCalledWith("TERMINADO");
    expect(
      screen.queryByRole("listbox", { name: "Opciones de estado de arreglo" })
    ).not.toBeInTheDocument();
  });

  it("soporta variant='field' con ancho completo y altura de campo de formulario", () => {
    render(<ArregloEstadoBadge estado="SIN_INICIAR" variant="field" onStateChange={vi.fn()} />);

    const trigger = screen.getByTestId("arreglo-estado-badge");
    expect(trigger).toHaveStyle({ width: "100%", height: "42px" });
    expect(screen.getByText("Sin iniciar")).toBeInTheDocument();
  });

  it("permite seleccionar PRESUPUESTO cuando allowPresupuesto es true", () => {
    render(<ArregloEstadoBadge estado="SIN_INICIAR" allowPresupuesto={true} onStateChange={vi.fn()} />);

    fireEvent.click(screen.getByTestId("arreglo-estado-badge"));

    expect(screen.getByTestId("arreglo-estado-option-PRESUPUESTO")).toBeInTheDocument();
  });

  it("excluye PRESUPUESTO cuando allowPresupuesto es false", () => {
    render(<ArregloEstadoBadge estado="PRESUPUESTO" allowPresupuesto={false} onStateChange={vi.fn()} />);

    fireEvent.click(screen.getByTestId("arreglo-estado-badge"));

    expect(screen.queryByTestId("arreglo-estado-option-PRESUPUESTO")).not.toBeInTheDocument();
  });

  it("deshabilita el botón cuando disabled es true", () => {
    render(<ArregloEstadoBadge estado="EN_PROGRESO" disabled={true} onStateChange={vi.fn()} />);

    expect(screen.getByTestId("arreglo-estado-badge")).toBeDisabled();
  });

  it("aplica tonalidad más clara para el seleccionado y más oscura para el enfocado sin outline", () => {
    render(<ArregloEstadoBadge estado="SIN_INICIAR" onStateChange={vi.fn()} />);

    fireEvent.click(screen.getByTestId("arreglo-estado-badge"));

    const sinIniciarOption = screen.getByTestId("arreglo-estado-option-SIN_INICIAR");
    const enProgresoOption = screen.getByTestId("arreglo-estado-option-EN_PROGRESO");

    // Seleccionado sin foco -> tonalidad clara
    expect(sinIniciarOption).toHaveStyle({ background: "#f1f5f9", outline: "none" });

    // Foco en enProgresoOption -> tonalidad más oscura
    fireEvent.focus(enProgresoOption);
    expect(enProgresoOption).toHaveStyle({ background: "#e2e8f0", outline: "none" });
  });

  describe("icono de info y tooltip en PRESUPUESTO", () => {
    const tooltipText =
      "Los repuestos asignados no se descontarán del stock mientras el arreglo se encuentre como presupuesto.";

    it("renderiza el icono de info solo en la opción de PRESUPUESTO", () => {
      render(
        <ArregloEstadoBadge estado="SIN_INICIAR" allowPresupuesto={true} onStateChange={vi.fn()} />
      );

      fireEvent.click(screen.getByTestId("arreglo-estado-badge"));

      const presupuestoOption = screen.getByTestId("arreglo-estado-option-PRESUPUESTO");
      const infoTrigger = screen.getByTestId("arreglo-presupuesto-info-trigger");
      expect(presupuestoOption).toContainElement(infoTrigger);

      const sinIniciarOption = screen.getByTestId("arreglo-estado-option-SIN_INICIAR");
      expect(sinIniciarOption.querySelector("[data-testid='arreglo-presupuesto-info-trigger']")).toBeNull();
    });

    it("muestra el tooltip al hacer hover en el icono de info y lo oculta al salir", () => {
      vi.useFakeTimers();
      render(
        <ArregloEstadoBadge estado="SIN_INICIAR" allowPresupuesto={true} onStateChange={vi.fn()} />
      );

      fireEvent.click(screen.getByTestId("arreglo-estado-badge"));
      const infoTrigger = screen.getByTestId("arreglo-presupuesto-info-trigger");

      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

      fireEvent.mouseEnter(infoTrigger);
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
      expect(screen.getByText(tooltipText)).toBeInTheDocument();

      fireEvent.mouseLeave(infoTrigger);
      act(() => {
        vi.advanceTimersByTime(150);
      });
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

      vi.useRealTimers();
    });

    it("abre el tooltip al hacer clic en el icono sin seleccionar el estado ni cerrar el menú", () => {
      const onStateChange = vi.fn();
      render(
        <ArregloEstadoBadge estado="SIN_INICIAR" allowPresupuesto={true} onStateChange={onStateChange} />
      );

      fireEvent.click(screen.getByTestId("arreglo-estado-badge"));
      const infoTrigger = screen.getByTestId("arreglo-presupuesto-info-trigger");

      fireEvent.click(infoTrigger);

      // Tooltip visible y contiene el texto exacto
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
      expect(screen.getByText(tooltipText)).toBeInTheDocument();

      // No dispara cambio de estado ni cierra el listbox
      expect(onStateChange).not.toHaveBeenCalled();
      expect(screen.getByRole("listbox")).toBeInTheDocument();

      // Clic nuevamente en el icono de info cierra el tooltip
      fireEvent.click(infoTrigger);
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });

    it("cierra el tooltip abierto por clic si se hace clic fuera del icono", () => {
      render(
        <ArregloEstadoBadge estado="SIN_INICIAR" allowPresupuesto={true} onStateChange={vi.fn()} />
      );

      fireEvent.click(screen.getByTestId("arreglo-estado-badge"));
      const infoTrigger = screen.getByTestId("arreglo-presupuesto-info-trigger");

      fireEvent.click(infoTrigger);
      expect(screen.getByRole("tooltip")).toBeInTheDocument();

      fireEvent.mouseDown(document.body);
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
  });
});
