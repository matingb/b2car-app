import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import Tooltip from "./Tooltip";

describe("Tooltip", () => {
  it("si content es falsy o undefined, solo renderiza children sin tooltip ni wrapper extra", () => {
    const { container } = render(
      <Tooltip content={undefined}>
        <button type="button">Botón normal</button>
      </Tooltip>
    );

    expect(screen.getByText("Botón normal")).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    // No hay wrapper span
    expect(container.querySelector("span")).toBeNull();
  });

  it("si disabled es true, no abre el tooltip al hacer hover", () => {
    render(
      <Tooltip content="Ayuda desactivada" disabled>
        <button type="button">Acción</button>
      </Tooltip>
    );

    fireEvent.mouseEnter(screen.getByText("Acción"));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("abre el tooltip en hover tras el delay y lo oculta en mouseleave", () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Texto informativo" delayMs={50}>
        <button type="button">Trigger</button>
      </Tooltip>
    );

    const trigger = screen.getByText("Trigger");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.mouseEnter(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByText("Texto informativo")).toBeInTheDocument();

    fireEvent.mouseLeave(trigger);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("permite fijar con click cuando trigger='both' y se cierra con click afuera o Escape", () => {
    render(
      <Tooltip content="Tooltip fijable" trigger="both" delayMs={0}>
        <button type="button">Info Icon</button>
      </Tooltip>
    );

    const trigger = screen.getByText("Info Icon");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    // Clic fija el tooltip
    fireEvent.click(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    // Mouse leave no lo cierra porque está pinned
    fireEvent.mouseLeave(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    // Escape lo cierra
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    // Clic afuera también lo cierra
    fireEvent.click(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("funciona sobre elementos disabled cuando se envuelven en Tooltip", () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Motivo de bloqueo" delayMs={0}>
        <button type="button" disabled>Guardar</button>
      </Tooltip>
    );

    const wrapper = screen.getByText("Guardar").parentElement!;
    fireEvent.mouseEnter(wrapper);
    act(() => {
      vi.advanceTimersByTime(10);
    });

    expect(screen.getByRole("tooltip")).toHaveTextContent("Motivo de bloqueo");
    vi.useRealTimers();
  });
});
