import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Badge from "./Badge";

describe("Badge", () => {
  it("renderiza texto correctamente como badge simple", () => {
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

  it("unifica title y value generando visualmente 'Title: Value' y en tooltip 'Title: Value'", () => {
    render(
      <Badge
        icon={<span data-testid="test-icon">icon</span>}
        title="Físico"
        value={63}
        dataTestId="badge-compound"
      />
    );
    expect(screen.getByText("Físico:")).toBeInTheDocument();
    expect(screen.getByText("63")).toBeInTheDocument();
    expect(screen.getByTestId("test-icon")).toBeInTheDocument();

    // Tooltip HTML generado automáticamente
    expect(screen.getByTestId("badge-compound")).toHaveAttribute("title", "Físico: 63");
  });

  it("oculta visualmente el title cuando showTitle={false} pero mantiene value, icono y tooltip", () => {
    render(
      <Badge
        icon={<span data-testid="test-icon">icon</span>}
        title="Físico"
        value={63}
        showTitle={false}
        dataTestId="badge-hidden-title"
      />
    );
    expect(screen.queryByText("Físico:")).not.toBeInTheDocument();
    expect(screen.getByText("63")).toBeInTheDocument();
    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
    // En tooltip se mantiene la información completa
    expect(screen.getByTestId("badge-hidden-title")).toHaveAttribute("title", "Físico: 63");
  });

  it("en badge simple mantiene title como tooltip HTML sin prefijo visual", () => {
    render(
      <Badge
        title="Información de estado"
        dataTestId="simple-badge-with-title"
      >
        Recibido
      </Badge>
    );
    expect(screen.getByText("Recibido")).toBeInTheDocument();
    expect(screen.queryByText("Información de estado:")).not.toBeInTheDocument();
    expect(screen.getByTestId("simple-badge-with-title")).toHaveAttribute("title", "Información de estado");
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
