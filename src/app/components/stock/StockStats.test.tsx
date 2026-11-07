import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import StockStats from "./StockStats";

describe("StockStats", () => {
  const defaultStats = {
    total: 25,
    criticos: 3,
    bajos: 5,
    altos: 2,
  };

  it("renderiza el texto 'ESTADOS DE STOCK' y el botón de info", () => {
    render(
      <StockStats
        stats={defaultStats}
        selectedEstado=""
        onSelectEstado={vi.fn()}
      />
    );

    expect(screen.getByText("ESTADOS DE STOCK")).toBeInTheDocument();
    const infoButton = screen.getByTestId("stock-stats-calc-info");
    expect(infoButton).toBeInTheDocument();
  });

  it("renderiza los valores de las 4 tarjetas de stock", () => {
    render(
      <StockStats
        stats={defaultStats}
        selectedEstado=""
        onSelectEstado={vi.fn()}
      />
    );

    expect(screen.getByText("Total items")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();

    expect(screen.getByText("Sin stock")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    expect(screen.getByText("Stock bajo")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();

    expect(screen.getByText("Exceso stock")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("permite seleccionar y deseleccionar un estado al hacer click en las tarjetas", () => {
    const onSelectEstado = vi.fn();
    const { rerender } = render(
      <StockStats
        stats={defaultStats}
        selectedEstado=""
        onSelectEstado={onSelectEstado}
      />
    );

    // Click en Sin stock
    fireEvent.click(screen.getByText("Sin stock"));
    expect(onSelectEstado).toHaveBeenCalledWith("critico");

    // Re-render con selectedEstado="critico" y hacer click de nuevo para deseleccionar
    rerender(
      <StockStats
        stats={defaultStats}
        selectedEstado="critico"
        onSelectEstado={onSelectEstado}
      />
    );
    fireEvent.click(screen.getByText("Sin stock"));
    expect(onSelectEstado).toHaveBeenCalledWith("");
  });

  it("muestra el tooltip con el cálculo y métricas coloreadas al hacer click o hover", () => {
    render(
      <StockStats
        stats={defaultStats}
        selectedEstado=""
        onSelectEstado={vi.fn()}
      />
    );

    const infoButton = screen.getByTestId("stock-stats-calc-info");
    expect(infoButton).toHaveAttribute(
      "aria-label",
      "El estado se calcula usando: disponible - reservado + pendiente"
    );
    
    act(() => {
      fireEvent.click(infoButton);
    });

    expect(screen.getByTestId("ui-tooltip")).toBeInTheDocument();
    expect(
      screen.getByText("El estado se calcula usando:")
    ).toBeInTheDocument();
    expect(screen.getByText("disponible")).toBeInTheDocument();
    expect(screen.getByText("reservado")).toBeInTheDocument();
    expect(screen.getByText("pendiente")).toBeInTheDocument();
  });
});

