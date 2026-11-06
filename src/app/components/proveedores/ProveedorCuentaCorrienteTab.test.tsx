import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/testUtils";
import ProveedorCuentaCorrienteTab from "./ProveedorCuentaCorrienteTab";
import { proveedoresClient } from "@/clients/proveedores/proveedoresClient";

vi.mock("@/clients/proveedores/proveedoresClient", () => ({
  proveedoresClient: {
    getOperaciones: vi.fn(),
  },
}));

describe("ProveedorCuentaCorrienteTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra empty state cuando no hay operaciones", async () => {
    vi.mocked(proveedoresClient.getOperaciones).mockResolvedValue({
      data: {
        totalComprado: 0,
        totalPagado: 0,
        saldoAdeudado: 0,
        operaciones: [],
      },
      error: null,
    });

    render(
      <ProveedorCuentaCorrienteTab
        proveedorId="prov-1"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Sin operaciones comerciales")).toBeInTheDocument();
    });
  });

  it("renderiza la tabla con operaciones y valores calculados", async () => {
    vi.mocked(proveedoresClient.getOperaciones).mockResolvedValue({
      data: {
        totalComprado: 50000,
        totalPagado: 20000,
        saldoAdeudado: 30000,
        operaciones: [
          {
            id: "op-12345678-abcd",
            tipo: "COMPRA",
            fecha: "2026-10-25T14:30:00Z",
            created_at: "2026-10-25T14:30:00Z",
            monto_total: 50000,
            total_pagado: 20000,
            saldo_pendiente: 30000,
            estado_pago: "PARCIAL",
            estado_stock: "PENDIENTE",
            observaciones: "Pedido de filtros",
            taller_id: "tal-1",
            taller_nombre: "Taller Central",
            lineas: [],
          },
        ],
      },
      error: null,
    });

    render(<ProveedorCuentaCorrienteTab proveedorId="prov-1" />);

    await waitFor(() => {
      expect(screen.getByText("Operación")).toBeInTheDocument();
      expect(screen.getByText("Taller Central")).toBeInTheDocument();
      expect(screen.getByText("COMPRA #OP-12345")).toBeInTheDocument();
      expect(screen.getByText("Pedido de filtros")).toBeInTheDocument();
      expect(screen.getByText("$50.000")).toBeInTheDocument();
      expect(screen.getByText("$20.000")).toBeInTheDocument();
      expect(screen.getByText("$30.000")).toBeInTheDocument();
    });
  });
});
