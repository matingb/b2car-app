import React from "react";
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/testUtils";
import ProveedorCuentaCorrienteTab from "./ProveedorCuentaCorrienteTab";

describe("ProveedorCuentaCorrienteTab", () => {
  it("muestra empty state cuando no hay movimientos", () => {
    render(
      <ProveedorCuentaCorrienteTab
        resumen={{
          totalComprado: 0,
          totalPagado: 0,
          saldoAdeudado: 0,
          operaciones: [],
          movimientos: [],
        }}
      />
    );

    expect(screen.getByText("Sin movimientos en cuenta corriente")).toBeInTheDocument();
  });

  it("renderiza el extracto contable simétrico (Debe / Haber / Saldo) sin link a /operaciones en movimientos directos", () => {
    render(
      <ProveedorCuentaCorrienteTab
        resumen={{
          totalComprado: 50000,
          totalPagado: 20000,
          saldoAdeudado: 30000,
          operaciones: [],
          movimientos: [
            {
              id: "mov-pago-1",
              fecha: "2026-10-26T10:00:00Z",
              created_at: "2026-10-26T10:00:00Z",
              tipo_movimiento: "PAGO_DIRECTO",
              concepto: "Pago a cuenta · Transferencia bancaria",
              comprobante: "OP #PAGO-999",
              debito: 0,
              credito: 20000,
              saldo_acumulado: 30000,
              operacion_id: null,
              cuenta_nombre: "Banco Galicia",
            },
            {
              id: "mov-compra-1",
              fecha: "2026-10-25T14:30:00Z",
              created_at: "2026-10-25T14:30:00Z",
              tipo_movimiento: "CARGO_COMPRA",
              concepto: "Orden de compra · Pedido de filtros",
              comprobante: "COMPRA #OP-12345",
              debito: 50000,
              credito: 0,
              saldo_acumulado: 50000,
              operacion_id: "op-12345678-abcd",
              cuenta_nombre: "Taller Central",
            },
          ],
        }}
      />
    );

    expect(screen.getByText("Concepto / Detalle")).toBeInTheDocument();
    expect(screen.getByText("Debe (+)")).toBeInTheDocument();
    expect(screen.getByText("Haber (-)")).toBeInTheDocument();
    expect(screen.getAllByText("Pago a cuenta · Transferencia bancaria").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Orden de compra · Pedido de filtros").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Banco Galicia").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("$50.000").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("$20.000").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("$30.000").length).toBeGreaterThanOrEqual(1);

    // La orden de compra enlaza a /operaciones/[id], mientras que el pago directo no tiene link
    const compraLinks = screen.getAllByRole("link", { name: "Orden de compra · Pedido de filtros" });
    expect(compraLinks[0]).toHaveAttribute("href", "/operaciones/op-12345678-abcd");
    expect(
      screen.queryByRole("link", { name: "Pago a cuenta · Transferencia bancaria" })
    ).not.toBeInTheDocument();
  });
});
