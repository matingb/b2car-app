import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
});
