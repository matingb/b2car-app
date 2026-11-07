import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StockBreakdownBadge, {
  createStockOption,
  formatStockBreakdownText,
} from "./StockBreakdownBadge";
import { COLOR } from "@/theme/theme";

describe("StockBreakdownBadge", () => {
  it("renders stock numbers with correct breakdown and labels", () => {
    render(
      <StockBreakdownBadge
        stock={{
          stockActual: 10,
          stockDisponible: 7,
          stockReservado: 3,
          stockPendiente: 5,
        }}
        dataTestId="badge-test"
      />
    );

    const badge = screen.getByTestId("badge-test");
    expect(badge).toHaveTextContent("Stock: 10 / 7 / 3 / 5");

    const fisico = screen.getByTestId("stock-breakdown-fisico");
    const disponible = screen.getByTestId("stock-breakdown-disponible");
    const reservado = screen.getByTestId("stock-breakdown-reservado");
    const pendiente = screen.getByTestId("stock-breakdown-pendiente");

    expect(fisico).toHaveTextContent("10");
    expect(fisico).toHaveStyle({ color: COLOR.TEXT.PRIMARY });

    expect(disponible).toHaveTextContent("7");
    expect(disponible).toHaveStyle({ color: COLOR.STATUS.SUCCESS.TEXT });

    expect(reservado).toHaveTextContent("3");
    expect(reservado).toHaveStyle({ color: COLOR.STATUS.WARNING.TEXT });

    expect(pendiente).toHaveTextContent("5");
    expect(pendiente).toHaveStyle({ color: COLOR.STATUS.DANGER.TEXT });
    expect(fisico).not.toHaveAttribute("title");
    expect(disponible).not.toHaveAttribute("title");
    expect(reservado).not.toHaveAttribute("title");
    expect(pendiente).not.toHaveAttribute("title");
    expect(badge.style.cursor).not.toBe("help");
  });

  it("calculates disponible fallback when missing", () => {
    render(
      <StockBreakdownBadge
        stock={{
          stockActual: 8,
          stockReservado: 2,
        }}
        dataTestId="badge-calc"
      />
    );

    expect(screen.getByTestId("badge-calc")).toHaveTextContent("Stock: 8 / 6 / 2 / 0");
  });

  it("shows tooltip on hovering metric numbers", async () => {
    render(
      <StockBreakdownBadge
        stock={{
          stockActual: 15,
          stockDisponible: 10,
          stockReservado: 5,
          stockPendiente: 2,
        }}
        dataTestId="badge-hover"
      />
    );

    const fisico = screen.getByTestId("stock-breakdown-fisico");
    fireEvent.mouseEnter(fisico);

    await waitFor(() => {
      const tooltip = screen.getByTestId("stock-breakdown-tooltip-fisico");
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveTextContent("Físico: 15");
    });
  });

  it("formatStockBreakdownText formats correctly", () => {
    const text = formatStockBreakdownText({
      fisico: 10,
      disponible: 8,
      reservado: 2,
      pendiente: 0,
    });
    expect(text).toBe("Stock: 10 / 8 / 2 / 0");
  });

  it("createStockOption builds an option with JSX secondaryLabel and searchText", () => {
    const opt = createStockOption({
      value: "STK-1",
      label: "Filtro Aceite",
      codePrefix: "FA-01 · ",
      stock: {
        stockActual: 20,
        stockDisponible: 15,
        stockReservado: 5,
        stockPendiente: 1,
      },
    });

    expect(opt.value).toBe("STK-1");
    expect(opt.label).toBe("Filtro Aceite");
    expect(opt.secondaryLabel).toBeDefined();
    expect(opt.searchText).toBe("FA-01 · Stock: 20 / 15 / 5 / 1");
  });
});
