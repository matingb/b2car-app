import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PagoSummaryBox from "./PagoSummaryBox";

describe("PagoSummaryBox", () => {
  it("renderiza correctamente los totales para tipo ARREGLO", () => {
    render(
      <PagoSummaryBox
        tipo="ARREGLO"
        total={10000}
        totalPagado={4000}
        saldoPendiente={6000}
      />
    );

    expect(screen.getByText("Total Arreglo")).toBeInTheDocument();
    expect(screen.getByText("Cobrado")).toBeInTheDocument();
    expect(screen.getByText("Saldo Pendiente")).toBeInTheDocument();

    expect(screen.getByTestId("summary-total")).toHaveTextContent("$10.000");
    expect(screen.getByTestId("summary-cobrado")).toHaveTextContent("$4.000");
    expect(screen.getByTestId("summary-saldo")).toHaveTextContent("$6.000");
  });

  it("renderiza correctamente las etiquetas para tipo COMPRA", () => {
    render(
      <PagoSummaryBox
        tipo="COMPRA"
        total={20000}
        totalPagado={20000}
        saldoPendiente={0}
      />
    );

    expect(screen.getByText("Total Acordado")).toBeInTheDocument();
    expect(screen.getByText("Pagado")).toBeInTheDocument();
    expect(screen.getByText("Saldo Pendiente")).toBeInTheDocument();

    expect(screen.getByTestId("summary-total")).toHaveTextContent("$20.000");
    expect(screen.getByTestId("summary-cobrado")).toHaveTextContent("$20.000");
    expect(screen.getByTestId("summary-saldo")).toHaveTextContent("$0");
  });

  it("renderiza correctamente las etiquetas para tipo VENTA", () => {
    render(
      <PagoSummaryBox
        tipo="VENTA"
        total={5000}
        totalPagado={2500}
        saldoPendiente={2500}
      />
    );

    expect(screen.getByText("Total Acordado")).toBeInTheDocument();
    expect(screen.getByText("Cobrado")).toBeInTheDocument();
    expect(screen.getByText("Saldo Pendiente")).toBeInTheDocument();

    expect(screen.getByTestId("summary-total")).toHaveTextContent("$5.000");
    expect(screen.getByTestId("summary-cobrado")).toHaveTextContent("$2.500");
    expect(screen.getByTestId("summary-saldo")).toHaveTextContent("$2.500");
  });

  it("muestra guión cuando isReady es false", () => {
    render(
      <PagoSummaryBox
        tipo="ARREGLO"
        total={10000}
        totalPagado={4000}
        saldoPendiente={6000}
        isReady={false}
      />
    );

    expect(screen.getByTestId("summary-total")).toHaveTextContent("-");
    expect(screen.getByTestId("summary-cobrado")).toHaveTextContent("-");
    expect(screen.getByTestId("summary-saldo")).toHaveTextContent("-");
  });
});
