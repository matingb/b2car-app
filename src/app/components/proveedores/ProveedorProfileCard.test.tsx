import React from "react";
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/testUtils";
import ProveedorProfileCard from "./ProveedorProfileCard";
import type { Proveedor } from "@/model/types";
import type { ProveedorCuentaCorrienteResumen } from "@/model/dtos";

const mockProveedor: Proveedor = {
  id: "prov-123",
  nombre: "B2CAR",
  cuit: "30-71649281-9",
  telefono: "+54 11 5763-2225",
  email: "contacto@b2car.com.ar",
  direccion: "Av. Warnes 1420, Chacarita, CABA",
};

const mockResumenAlDia: ProveedorCuentaCorrienteResumen = {
  totalComprado: 50000,
  totalPagado: 50000,
  saldoAdeudado: 0,
  operaciones: [],
};

const mockResumenConDeuda: ProveedorCuentaCorrienteResumen = {
  totalComprado: 100000,
  totalPagado: 40000,
  saldoAdeudado: 60000,
  operaciones: [],
};

describe("ProveedorProfileCard", () => {
  it("renderiza datos del proveedor, avatar con iniciales y estado al día", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <ProveedorProfileCard
        proveedor={mockProveedor}
        resumenCuentaCorriente={mockResumenAlDia}
        onEditProveedor={onEdit}
        onDeleteProveedor={onDelete}
      />
    );

    // Avatar squircle con iniciales
    expect(screen.getByText("B2")).toBeInTheDocument();

    // Nombre y dirección
    expect(screen.getByText("B2CAR")).toBeInTheDocument();
    expect(screen.getByText("Av. Warnes 1420, Chacarita, CABA")).toBeInTheDocument();

    // Saldo cta cte y badge
    expect(screen.getByText("Al día")).toBeInTheDocument();

    // Datos de contacto y fiscales
    expect(screen.getByText("DATOS DE CONTACTO Y FISCALES")).toBeInTheDocument();
    expect(screen.getByText("contacto@b2car.com.ar")).toBeInTheDocument();
    expect(screen.getByText("+54 11 5763-2225")).toBeInTheDocument();
    expect(screen.getByText("30-71649281-9")).toBeInTheDocument();

    // Botones de acción
    const editBtn = screen.getByTestId("proveedor-detail-edit");
    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledTimes(1);

    const deleteBtn = screen.getByTestId("proveedor-detail-delete");
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("renderiza deuda pendiente cuando saldoAdeudado > 0", () => {
    render(
      <ProveedorProfileCard
        proveedor={mockProveedor}
        resumenCuentaCorriente={mockResumenConDeuda}
        onEditProveedor={vi.fn()}
      />
    );

    expect(screen.getByText("Deuda pendiente")).toBeInTheDocument();
    expect(screen.getByText(/\$\s*60\.000/)).toBeInTheDocument();
  });
});
