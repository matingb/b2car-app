import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/testUtils";
import ProductoKardexModal from "./ProductoKardexModal";
import { productosClient } from "@/clients/productosClient";

vi.mock("@/clients/productosClient", () => ({
  productosClient: {
    getMovimientosStock: vi.fn(),
  },
}));

describe("ProductoKardexModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza el historial de movimientos de stock (Kardex)", async () => {
    vi.mocked(productosClient.getMovimientosStock).mockResolvedValue({
      data: [
        {
          id: "mov-1",
          tenant_id: "t-1",
          stock_id: "s-1",
          producto_id: "prod-1",
          taller_id: "taller-1",
          taller_nombre: "Taller Central",
          tipo_movimiento: "COMPRA",
          cantidad: 10,
          saldo_anterior: 0,
          saldo_posterior: 10,
          fecha: "2026-10-21T10:00:00Z",
          created_at: "2026-10-21T10:00:00Z",
          operacion_id: "00000000-0000-0000-0000-000000000001",
          motivo: "Orden de compra #1",
        },
        {
          id: "mov-2",
          tenant_id: "t-1",
          stock_id: "s-1",
          producto_id: "prod-1",
          taller_id: "taller-1",
          taller_nombre: "Taller Central",
          tipo_movimiento: "VENTA",
          cantidad: -3,
          saldo_anterior: 10,
          saldo_posterior: 7,
          fecha: "2026-10-21T12:00:00Z",
          created_at: "2026-10-21T12:00:00Z",
          operacion_id: "00000000-0000-0000-0000-000000000002",
          motivo: "Venta mostrador",
        },
      ],
      error: null,
    });

    render(
      <ProductoKardexModal
        open={true}
        onClose={vi.fn()}
        productoId="prod-1"
        productoNombre="Aceite 10W40"
        productoCodigo="OIL-10W40"
        talleres={[{ id: "taller-1", nombre: "Taller Central" }]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Kardex: Aceite 10W40 (OIL-10W40)")).toBeInTheDocument();
    });

    expect(screen.getAllByText("+10").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("-3").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/10\s*u\./)).toBeInTheDocument();
    expect(screen.getByText(/7\s*u\./)).toBeInTheDocument();
    expect(screen.getByText("Total ingresos:")).toBeInTheDocument();
    expect(screen.getByText("Total egresos:")).toBeInTheDocument();
  });

  it("muestra estado vacío si el producto no registra movimientos", async () => {
    vi.mocked(productosClient.getMovimientosStock).mockResolvedValue({
      data: [],
      error: null,
    });

    render(
      <ProductoKardexModal
        open={true}
        onClose={vi.fn()}
        productoId="prod-1"
        productoNombre="Aceite 10W40"
        productoCodigo="OIL-10W40"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("No hay movimientos registrados para este producto.")).toBeInTheDocument();
    });
  });
});
