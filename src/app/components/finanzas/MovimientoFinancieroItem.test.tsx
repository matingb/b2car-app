import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MovimientoFinancieroItem from "./MovimientoFinancieroItem";
import type { MovimientoFinanciero } from "@/model/finanzas";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("MovimientoFinancieroItem", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  const sampleMovement: MovimientoFinanciero = {
    id: "mov-1",
    cuentaId: "cuenta-1",
    tipo: "GASTO",
    importe: -1500,
    descripcion: "Compra de insumos",
    categoria: "REPUESTOS",
    operacionId: "op-100",
    fecha: "2026-08-20T10:00:00Z",
    reversaMovimientoId: null,
    createdAt: "2026-08-20T10:00:00Z",
  };

  it("renderiza correctamente la descripción, categoría y monto formateado", () => {
    render(<MovimientoFinancieroItem movimiento={sampleMovement} isLast={false} />);

    expect(screen.getByText("Compra de insumos")).toBeInTheDocument();
    expect(screen.getByText("repuestos")).toBeInTheDocument();
    expect(screen.getByText(/- \$1\.500/)).toBeInTheDocument();
  });

  it("maneja ingresos correctamente con signo +", () => {
    const incomeMovement: MovimientoFinanciero = {
      ...sampleMovement,
      id: "mov-2",
      tipo: "COBRO_ARREGLO",
      importe: 5000,
      descripcion: "Cobro trabajo #123",
      categoria: null,
      operacionId: null,
    };

    render(<MovimientoFinancieroItem movimiento={incomeMovement} isLast={true} />);

    expect(screen.getByText("Cobro trabajo #123")).toBeInTheDocument();
    expect(screen.getByText(/\+ \$5\.000/)).toBeInTheDocument();
  });

  it("navega a la operación correspondiente al hacer click cuando tiene operacionId", () => {
    render(<MovimientoFinancieroItem movimiento={sampleMovement} isLast={false} />);

    const item = screen.getByRole("button");
    fireEvent.click(item);

    expect(mockPush).toHaveBeenCalledWith("/operaciones?operacion_id=op-100");
  });

  it("navega al arreglo correspondiente al hacer click cuando tiene arregloId", () => {
    const arregloMovement: MovimientoFinanciero = {
      ...sampleMovement,
      id: "mov-3",
      tipo: "COBRO_ARREGLO",
      arregloId: "arr-777",
      operacionId: "op-200",
    };

    render(<MovimientoFinancieroItem movimiento={arregloMovement} isLast={false} />);

    const item = screen.getByRole("button");
    fireEvent.click(item);

    expect(mockPush).toHaveBeenCalledWith("/arreglos/arr-777");
  });

  it("ejecuta el onClick provisto si se pasa por props", () => {
    const customOnClick = vi.fn();
    render(
      <MovimientoFinancieroItem
        movimiento={sampleMovement}
        isLast={false}
        onClick={customOnClick}
      />
    );

    const item = screen.getByRole("button");
    fireEvent.click(item);

    expect(customOnClick).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
