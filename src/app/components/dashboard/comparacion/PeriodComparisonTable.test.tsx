import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PeriodComparisonTable, { COMPARISON_ROW_HEIGHT } from "./PeriodComparisonTable";
import type { ComparisonRowView } from "@/app/hooks/dashboard/useDashboardControls";
import { COMPARISON_COLUMNS } from "@/lib/dashboard/cards";
import type { PeriodoTotals } from "@/lib/dashboard/totals";

function totals(facturacion: number): PeriodoTotals {
  return {
    arreglos: 0,
    cobrados: 0,
    parciales: 0,
    pendientes: 0,
    porCobrar: 0,
    facturacion,
    manoDeObra: facturacion,
    repuestos: 0,
    ventas: 0,
    gastos: 0,
    gastoRepuestos: 0,
    sueldos: 0,
    eventuales: 0,
    balance: facturacion,
    margen: 1,
  };
}

function row(id: string, label: string, facturacion: number, index: number): ComparisonRowView {
  return {
    id,
    isReference: index === 0,
    usesDashboardData: false,
    label,
    detail: null,
    period: { label, from: "2026-08-01T03:00:00.000Z", to: "2026-09-01T03:00:00.000Z" },
    visible: true,
    color: "#007f9e",
    visibilityBlocker: null,
    status: "ready",
    error: null,
    periodo: null,
    totals: totals(facturacion),
  };
}

const rows = [row("a", "Agosto 2026", 1000, 0), row("b", "Julio 2026", 1500, 1), row("c", "Junio 2026", 500, 2)];

function renderTable(onMove = vi.fn()) {
  render(
    <PeriodComparisonTable
      rows={rows}
      columns={COMPARISON_COLUMNS.facturacion}
      onToggleVisibility={vi.fn()}
      onRemove={vi.fn()}
      onRetry={vi.fn()}
      onMove={onMove}
    />,
  );
  return onMove;
}

describe("PeriodComparisonTable", () => {
  it("compara cada fila contra la primera y explica la referencia en un tooltip", () => {
    renderTable();

    const referencia = screen.getByTestId("comparacion-fila-a");
    expect(referencia).not.toHaveTextContent("▲");
    expect(screen.getAllByTestId("comparacion-ayuda-referencia")).toHaveLength(1);

    fireEvent.click(within(referencia).getByTestId("comparacion-ayuda-referencia"));
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Cada período se compara contra el de arriba de todo. Arrastrá las filas para cambiar el orden.",
    );

    expect(screen.getByTestId("comparacion-fila-b")).toHaveTextContent("▲ 50%");
    expect(screen.getByTestId("comparacion-fila-c")).toHaveTextContent("▼ 50%");
  });

  it("deja quitar cualquier fila, incluida la referencia", () => {
    renderTable();
    expect(screen.getByRole("button", { name: "Quitar Agosto 2026" })).toBeEnabled();
  });

  it("reordena con las flechas del teclado", () => {
    const onMove = renderTable();

    fireEvent.keyDown(screen.getByTestId("comparacion-mover-b"), { key: "ArrowUp" });
    fireEvent.keyDown(screen.getByTestId("comparacion-mover-b"), { key: "ArrowDown" });

    expect(onMove).toHaveBeenNthCalledWith(1, "b", 0);
    expect(onMove).toHaveBeenNthCalledWith(2, "b", 2);
  });

  it("todas las filas tienen el mismo alto", () => {
    renderTable();
    for (const r of rows) {
      const firstCell = screen.getByTestId(`comparacion-fila-${r.id}`).querySelector("td")!;
      expect(firstCell).toHaveStyle({ height: `${COMPARISON_ROW_HEIGHT}px` });
    }
  });

  describe("arrastre", () => {
    const cellOf = (id: string) => screen.getByTestId(`comparacion-fila-${id}`).querySelector("td")!;

    function startDrag(id: string, clientY: number) {
      vi.spyOn(screen.getByTestId(`comparacion-fila-${id}`), "getBoundingClientRect").mockReturnValue({
        height: COMPARISON_ROW_HEIGHT,
      } as DOMRect);
      const handle = screen.getByTestId(`comparacion-mover-${id}`);
      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientY });
      return handle;
    }

    it("la fila sigue al puntero y las que quedan en el camino se corren para hacerle lugar", () => {
      renderTable();
      const handle = startDrag("c", 200);

      fireEvent.pointerMove(handle, { pointerId: 1, clientY: 200 - 2 * COMPARISON_ROW_HEIGHT + 10 });

      expect(cellOf("c")).toHaveStyle({ transform: `translateY(${-2 * COMPARISON_ROW_HEIGHT + 10}px)` });
      expect(cellOf("a")).toHaveStyle({ transform: `translateY(${COMPARISON_ROW_HEIGHT}px)` });
      expect(cellOf("b")).toHaveStyle({ transform: `translateY(${COMPARISON_ROW_HEIGHT}px)` });
    });

    it("al soltar, mueve la fila a la posición más cercana", () => {
      const onMove = renderTable();
      const handle = startDrag("c", 200);

      fireEvent.pointerMove(handle, { pointerId: 1, clientY: 200 - 2 * COMPARISON_ROW_HEIGHT + 10 });
      fireEvent.pointerUp(handle, { pointerId: 1 });

      expect(onMove).toHaveBeenCalledWith("c", 0);
      expect(cellOf("a")).toHaveStyle({ transform: "translateY(0px)" });
    });

    it("no deja sacar la fila de la tabla y no mueve nada si se suelta en el mismo lugar", () => {
      const onMove = renderTable();
      const handle = startDrag("a", 100);

      fireEvent.pointerMove(handle, { pointerId: 1, clientY: -500 });
      expect(cellOf("a")).toHaveStyle({ transform: "translateY(0px)" });

      fireEvent.pointerUp(handle, { pointerId: 1 });
      expect(onMove).not.toHaveBeenCalled();
    });
  });
});
