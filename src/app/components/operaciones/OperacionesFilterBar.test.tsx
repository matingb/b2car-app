import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import OperacionesFilterBar from "./OperacionesFilterBar";
import { buildMonthPeriod } from "@/lib/dashboard/periods";

describe("OperacionesFilterBar", () => {
  const defaultPeriod = buildMonthPeriod(2026, 10); // Noviembre 2026

  const defaultProps = {
    selectedTipos: [],
    onToggleTipo: vi.fn(),
    period: defaultPeriod,
    onPeriodChange: vi.fn(),
    fechaDesde: "",
    fechaHasta: "",
    onFechaDesdeChange: vi.fn(),
    onFechaHastaChange: vi.fn(),
    estadoPago: "" as const,
    onEstadoPagoChange: vi.fn(),
    estadoEntrega: "" as const,
    onEstadoEntregaChange: vi.fn(),
    onClearAll: vi.fn(),
    hasActiveFilters: false,
    isCustomPeriod: false,
    onResetPeriod: vi.fn(),
  };

  it("renderiza la barra de filtros con los tipos de operación y dropdowns compactos", () => {
    render(<OperacionesFilterBar {...defaultProps} />);

    expect(screen.getByTestId("operaciones-filter-bar")).toBeInTheDocument();
    expect(screen.getByTestId("operaciones-chip-COMPRA")).toHaveTextContent("Compra");
    expect(screen.getByTestId("operaciones-chip-VENTA")).toHaveTextContent("Venta");
    expect(screen.getByTestId("operaciones-chip-GASTO")).toHaveTextContent("Gasto");
    expect(screen.getByTestId("operaciones-chip-INGRESO")).toHaveTextContent("Ingreso");

    expect(screen.getByTestId("operaciones-filter-periodo-trigger")).toBeInTheDocument();
    expect(screen.getByTestId("operaciones-filter-pago-trigger")).toHaveTextContent("Pago: Todos");
    expect(screen.getByTestId("operaciones-filter-entrega-trigger")).toHaveTextContent("Entrega: Todos");
  });

  it("llama a onToggleTipo al hacer clic en un tipo de operación", () => {
    const onToggleTipo = vi.fn();
    render(<OperacionesFilterBar {...defaultProps} onToggleTipo={onToggleTipo} />);

    fireEvent.click(screen.getByTestId("operaciones-chip-VENTA"));
    expect(onToggleTipo).toHaveBeenCalledWith("VENTA");

    fireEvent.click(screen.getByTestId("operaciones-chip-COMPRA"));
    expect(onToggleTipo).toHaveBeenCalledWith("COMPRA");
  });

  it("permite abrir el popover de período y configurar rango de fechas", () => {
    const onFechaDesdeChange = vi.fn();
    render(<OperacionesFilterBar {...defaultProps} onFechaDesdeChange={onFechaDesdeChange} />);

    // Abrir popover
    fireEvent.click(screen.getByTestId("operaciones-filter-periodo-trigger"));
    expect(screen.getByTestId("operaciones-periodo-popover")).toBeInTheDocument();
    expect(screen.getByTestId("operaciones-filter-fecha-desde")).toBeInTheDocument();
    expect(screen.getByTestId("operaciones-filter-fecha-hasta")).toBeInTheDocument();

    // Cerrar con el botón Listo
    fireEvent.click(screen.getByTestId("operaciones-filter-periodo-apply"));
    expect(screen.queryByTestId("operaciones-periodo-popover")).not.toBeInTheDocument();
  });

  it("permite abrir el menú de pago y seleccionar un estado", () => {
    const onEstadoPagoChange = vi.fn();
    render(<OperacionesFilterBar {...defaultProps} onEstadoPagoChange={onEstadoPagoChange} />);

    // Abrir dropdown de pago
    fireEvent.click(screen.getByTestId("operaciones-filter-pago-trigger"));
    expect(screen.getByTestId("operaciones-pago-menu")).toBeInTheDocument();

    // Seleccionar 'Pagado'
    fireEvent.click(screen.getByTestId("operaciones-filter-pago-PAGADO"));
    expect(onEstadoPagoChange).toHaveBeenCalledWith("PAGADO");
  });

  it("permite abrir el menú de entrega y seleccionar un estado", () => {
    const onEstadoEntregaChange = vi.fn();
    render(<OperacionesFilterBar {...defaultProps} onEstadoEntregaChange={onEstadoEntregaChange} />);

    // Abrir dropdown de entrega
    fireEvent.click(screen.getByTestId("operaciones-filter-entrega-trigger"));
    expect(screen.getByTestId("operaciones-entrega-menu")).toBeInTheDocument();

    // Seleccionar 'Entregado'
    fireEvent.click(screen.getByTestId("operaciones-filter-entrega-ENTREGADO"));
    expect(onEstadoEntregaChange).toHaveBeenCalledWith("ENTREGADO");
  });

  it("muestra botón 'Limpiar filtros' cuando hay filtros activos y llama a onClearAll", () => {
    const onClearAll = vi.fn();
    render(
      <OperacionesFilterBar
        {...defaultProps}
        hasActiveFilters={true}
        onClearAll={onClearAll}
      />
    );

    const clearBtn = screen.getByTestId("operaciones-clear-all-filters");
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn);
    expect(onClearAll).toHaveBeenCalled();
  });

  it("permite limpiar un filtro individual directamente con el botón X del pill", () => {
    const onEstadoPagoChange = vi.fn();
    render(
      <OperacionesFilterBar
        {...defaultProps}
        estadoPago="PAGADO"
        onEstadoPagoChange={onEstadoPagoChange}
      />
    );

    const clearMiniBtn = screen.getByLabelText("Limpiar filtro de pago");
    expect(clearMiniBtn).toBeInTheDocument();
    fireEvent.click(clearMiniBtn);
    expect(onEstadoPagoChange).toHaveBeenCalledWith("");
  });
});

