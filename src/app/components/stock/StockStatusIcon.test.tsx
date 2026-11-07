import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StockStatusIcon from "./StockStatusIcon";
import { COLOR } from "@/theme/theme";

describe("StockStatusIcon", () => {
  it("renderiza correctamente para estado 'critico'", () => {
    render(<StockStatusIcon status="critico" data-testid="status-critico" />);
    const el = screen.getByTestId("status-critico");

    expect(el).toHaveAttribute("aria-label", "Sin stock");
    expect(el).toHaveAttribute("title", "Sin stock");
    expect(el).toHaveStyle({
      color: COLOR.ICON.DANGER,
      backgroundColor: COLOR.BACKGROUND.DANGER_TINT,
    });
  });

  it("renderiza correctamente para estado 'bajo'", () => {
    render(<StockStatusIcon status="bajo" data-testid="status-bajo" />);
    const el = screen.getByTestId("status-bajo");

    expect(el).toHaveAttribute("aria-label", "Stock bajo");
    expect(el).toHaveAttribute("title", "Stock bajo");
    expect(el).toHaveStyle({
      color: COLOR.SEMANTIC.WARNING,
      backgroundColor: COLOR.BACKGROUND.WARNING_TINT,
    });
  });

  it("renderiza correctamente para estado 'normal'", () => {
    render(<StockStatusIcon status="normal" data-testid="status-normal" />);
    const el = screen.getByTestId("status-normal");

    expect(el).toHaveAttribute("aria-label", "Stock normal");
    expect(el).toHaveAttribute("title", "Stock normal");
    expect(el).toHaveStyle({
      color: COLOR.SEMANTIC.SUCCESS,
      backgroundColor: COLOR.BACKGROUND.SUCCESS_TINT,
    });
  });

  it("renderiza correctamente para estado 'alto'", () => {
    render(<StockStatusIcon status="alto" data-testid="status-alto" />);
    const el = screen.getByTestId("status-alto");

    expect(el).toHaveAttribute("aria-label", "Exceso stock");
    expect(el).toHaveAttribute("title", "Exceso stock");
    expect(el).toHaveStyle({
      color: COLOR.ACCENT.PRIMARY,
      backgroundColor: COLOR.BACKGROUND.INFO_TINT,
    });
  });

  it("renderiza estado por defecto cuando status es null o undefined", () => {
    render(<StockStatusIcon status={null} data-testid="status-null" />);
    const el = screen.getByTestId("status-null");

    expect(el).toHaveAttribute("aria-label", "Sin stock configurado");
    expect(el).toHaveAttribute("title", "Sin stock configurado");
    expect(el).toHaveStyle({
      color: COLOR.SEMANTIC.DISABLED,
      backgroundColor: COLOR.BACKGROUND.DISABLED_TINT,
    });
  });

  it("aplica dimensiones personalizadas vía boxSize y borderRadius", () => {
    render(
      <StockStatusIcon
        status="normal"
        size={16}
        boxSize={32}
        borderRadius={8}
        data-testid="status-custom"
      />
    );
    const el = screen.getByTestId("status-custom");

    expect(el).toHaveStyle({
      width: "32px",
      height: "32px",
      borderRadius: "8px",
    });
  });
});

