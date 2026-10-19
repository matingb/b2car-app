import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Card from "./Card";

const HOVER_TRANSFORM = "translateY(-2px)";

describe("Card", () => {
  it("aplica el hover cuando es clickeable", () => {
    render(<Card onClick={vi.fn()} data-testid="card">Contenido</Card>);
    const card = screen.getByTestId("card");

    fireEvent.mouseOver(card);
    expect(card.style.transform).toBe(HOVER_TRANSFORM);

    fireEvent.mouseLeave(card);
    expect(card.style.transform).toBe("");
  });

  it("una Card anidada y aislada conserva su hover sin activar el de la Card contenedora", () => {
    render(
      <Card onClick={vi.fn()} data-testid="padre">
        <Card onClick={vi.fn()} data-testid="hija" data-isolate-hover="true">
          <span>Documento</span>
        </Card>
      </Card>,
    );

    fireEvent.mouseOver(screen.getByText("Documento"));

    expect(screen.getByTestId("hija").style.transform).toBe(HOVER_TRANSFORM);
    expect(screen.getByTestId("padre").style.transform).toBe("");
  });

  it("un elemento aislado dentro de la Card no activa su hover", () => {
    render(
      <Card onClick={vi.fn()} data-testid="card">
        <button type="button" data-isolate-hover="true">Badge</button>
      </Card>,
    );

    fireEvent.mouseOver(screen.getByRole("button", { name: "Badge" }));

    expect(screen.getByTestId("card").style.transform).toBe("");
  });
});
