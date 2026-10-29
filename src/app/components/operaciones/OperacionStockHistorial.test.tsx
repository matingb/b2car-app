import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import OperacionStockHistorial from "./OperacionStockHistorial";
import type { OperacionMovimientoStock } from "@/model/types";

describe("OperacionStockHistorial", () => {
  const movimientosMock: OperacionMovimientoStock[] = [
    {
      id: "mov-1",
      fecha: "2026-10-27T10:00:00.000Z",
      cantidad: -6,
      saldo_anterior: 20,
      saldo_posterior: 14,
      producto_id: "prod-1",
      stock_id: "stock-1",
      producto_nombre: "Filtro de Aceite",
      producto_codigo: "FIL-01",
      created_at: "2026-10-27T10:00:00.000Z",
    },
    {
      id: "mov-2",
      fecha: "2026-10-27T11:00:00.000Z",
      cantidad: -4,
      saldo_anterior: 14,
      saldo_posterior: 10,
      producto_id: "prod-2",
      stock_id: "stock-2",
      producto_nombre: "Aceite Sintético",
      producto_codigo: "OIL-5W30",
      created_at: "2026-10-27T11:00:00.000Z",
      revertido: true,
    },
  ];

  it("no renderiza nada si no hay movimientos", () => {
    const { container } = render(<OperacionStockHistorial movimientos={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renderiza el botón de colapso con el total de unidades activas", () => {
    render(
      <OperacionStockHistorial
        movimientos={movimientosMock}
        tipo="VENTA"
      />
    );

    expect(screen.getByTestId("operacion-stock-historial-toggle")).toBeInTheDocument();
    expect(screen.getByText("Entregas registradas previamente (2)")).toBeInTheDocument();
    // 6 activas (mov-2 está revertido)
    expect(screen.getByText("6 u. activas")).toBeInTheDocument();
  });

  it("despliega la lista al hacer click en el toggle", () => {
    render(
      <OperacionStockHistorial
        movimientos={movimientosMock}
        tipo="VENTA"
      />
    );

    const toggle = screen.getByTestId("operacion-stock-historial-toggle");
    fireEvent.click(toggle);

    expect(screen.getByTestId("operacion-stock-historial-list")).toBeInTheDocument();
    expect(screen.getByText("Filtro de Aceite")).toBeInTheDocument();
    expect(screen.getByText("Aceite Sintético")).toBeInTheDocument();
    expect(screen.getByText("Revertido")).toBeInTheDocument();
  });

  it("llama a onRevertirMovimiento al hacer click en el botón de reversión de un ítem activo", () => {
    const onRevertir = vi.fn();
    render(
      <OperacionStockHistorial
        movimientos={movimientosMock}
        tipo="VENTA"
        onRevertirMovimiento={onRevertir}
      />
    );

    fireEvent.click(screen.getByTestId("operacion-stock-historial-toggle"));

    const btnRevertir = screen.getByTestId("btn-revertir-stock-mov-1");
    expect(btnRevertir).toBeInTheDocument();
    fireEvent.click(btnRevertir);

    expect(onRevertir).toHaveBeenCalledWith("mov-1", 6, "Filtro de Aceite");
  });

  it("no muestra el botón de reversión para ítems ya revertidos", () => {
    render(
      <OperacionStockHistorial
        movimientos={movimientosMock}
        tipo="VENTA"
        onRevertirMovimiento={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId("operacion-stock-historial-toggle"));
    expect(screen.queryByTestId("btn-revertir-stock-mov-2")).not.toBeInTheDocument();
  });

  it("no muestra movimientos de reversión en el listado del modal", () => {
    const movsConReversion: OperacionMovimientoStock[] = [
      ...movimientosMock,
      {
        id: "mov-rev-1",
        fecha: "2026-10-27T12:00:00.000Z",
        cantidad: 4,
        saldo_anterior: 10,
        saldo_posterior: 14,
        producto_id: "prod-2",
        stock_id: "stock-2",
        producto_nombre: "Aceite Sintético",
        producto_codigo: "OIL-5W30",
        tipo_movimiento: "REVERSION",
        reversion_de_id: "mov-2",
        motivo: "Reversión de entrega",
        created_at: "2026-10-27T12:00:00.000Z",
      },
    ];

    render(
      <OperacionStockHistorial
        movimientos={movsConReversion}
        tipo="VENTA"
        onRevertirMovimiento={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId("operacion-stock-historial-toggle"));

    expect(screen.queryByTestId("stock-historial-item-mov-rev-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("btn-revertir-stock-mov-rev-1")).not.toBeInTheDocument();
  });
});
