import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Badge from "./Badge";

describe("Badge", () => {
  it("renderiza texto correctamente", () => {
    render(<Badge color="success">Recibido</Badge>);
    expect(screen.getByText("Recibido")).toBeInTheDocument();
  });

  it("renderiza icono cuando se provee", () => {
    render(
      <Badge icon={<span data-testid="test-icon">icon</span>}>
        Con icono
      </Badge>
    );
    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });

  it("renderiza como botón interactivo cuando tiene onClick", () => {
    const handleClick = vi.fn();
    render(
      <Badge onClick={handleClick} dataTestId="interactive-badge">
        Clickable
      </Badge>
    );

    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("aplica estilos correctos para variante subtle", () => {
    render(
      <Badge variant="subtle" color="warning" dataTestId="warning-badge">
        En espera
      </Badge>
    );
    const badge = screen.getByTestId("warning-badge");
    expect(badge).toHaveStyle({ backgroundColor: "rgba(245, 158, 11, 0.12)" });
  });
});
