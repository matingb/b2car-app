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
});
