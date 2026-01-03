import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import CardDato from "./CardDato";

describe("CardDato", () => {
  beforeEach(() => {
    vi.spyOn(performance, "now").mockReturnValue(0);

    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      // Resolve animation immediately at t=1 (duration is 1500ms in component).
      cb(1500);
      return 1;
    });

    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Debe usar formato es-ES para enteros", async () => {
    render(<CardDato titleText="Clientes" value={1234} />);
    expect(await screen.findByText("1.234")).toBeInTheDocument();
  });

  it("Debe usar formato es-ES, con dos decimales para decimales", async () => {
    render(<CardDato titleText="Ingresos" value={1234.5} />);
    expect(await screen.findByText("1.234,50")).toBeInTheDocument();
  });

  it("Debe agregar prefijo al valor formateado", async () => {
    render(<CardDato titleText="Ingresos" value={1234.5} prefix="$ " />);
    expect(await screen.findByText("$ 1.234,50")).toBeInTheDocument();
  });

  it('Cuando no hay value, debe mostrar vacio', () => {
    render(<CardDato titleText="Clientes" />);
    expect(screen.getByText("")).toBeInTheDocument();
  });
});


