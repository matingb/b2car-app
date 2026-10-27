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
        animate={false}
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
        animate={false}
      />
    );

    expect(screen.getByText("Total Acordado")).toBeInTheDocument();
    expect(screen.getByText("Pagado")).toBeInTheDocument();
    expect(screen.getByText("Saldo Pendiente")).toBeInTheDocument();

    expect(screen.getByTestId("summary-total")).toHaveTextContent("$20.000");
    expect(screen.getByTestId("summary-cobrado")).toHaveTextContent("$20.000");
    expect(screen.getByTestId("summary-saldo")).toHaveTextContent("$0");
  });

  it("permite personalizar etiquetas y testIds", () => {
    render(
      <PagoSummaryBox
        total={5000}
        totalPagado={2500}
        saldoPendiente={2500}
        totalLabel="Total Presupuestado"
        pagadoLabel="Anticipo Recibido"
        saldoLabel="A Liquidar"
        dataTestIdTotal="custom-total"
        dataTestIdPagado="custom-pagado"
        dataTestIdSaldo="custom-saldo"
        animate={false}
      />
    );

    expect(screen.getByText("Total Presupuestado")).toBeInTheDocument();
    expect(screen.getByText("Anticipo Recibido")).toBeInTheDocument();
    expect(screen.getByText("A Liquidar")).toBeInTheDocument();

    expect(screen.getByTestId("custom-total")).toHaveTextContent("$5.000");
    expect(screen.getByTestId("custom-pagado")).toHaveTextContent("$2.500");
    expect(screen.getByTestId("custom-saldo")).toHaveTextContent("$2.500");
  });
});
