import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import OperacionLineaEditor, { type OperacionLineaDraft } from "./OperacionLineaEditor";

vi.mock("@/app/components/ui/Autocomplete", () => ({
  __esModule: true,
  default: ({
    value,
    onChange,
    dataTestId,
    disabled,
  }: {
    value: string;
    onChange: (v: string) => void;
    dataTestId?: string;
    disabled?: boolean;
  }) => (
    <input
      data-testid={dataTestId}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

function Wrapper(props: { initial: OperacionLineaDraft }) {
  const [linea, setLinea] = useState<OperacionLineaDraft>(props.initial);
  return (
    <OperacionLineaEditor
      index={0}
      linea={linea}
      disabled={false}
      loadingStocks={false}
      stockOptions={[]}
      onChange={setLinea}
      canRemove={false}
    />
  );
}

describe("OperacionLineaEditor", () => {
  it("Al actualizar la cantidad, se actualiza el total manteniendo el precio unitario", () => {
    render(
      <Wrapper
        initial={{
          id: "l1",
          stockId: "p1",
          cantidad: 2,
          unitario: 10,
          total: 20,
        }}
      />
    );

    act(() => {
      fireEvent.change(screen.getByTestId("operaciones-line-0-cantidad"), {
        target: { value: "3" },
      });
    });

    expect(screen.getByTestId("operaciones-line-0-unitario")).toHaveValue(10);
    expect(screen.getByTestId("operaciones-line-0-total")).toHaveValue(30);
  });

  it("Al actualizar el precio unitario, se actualiza el total manteniendo la cantidad", () => {
    render(
      <Wrapper
        initial={{
          id: "l1",
          stockId: "p1",
          cantidad: 3,
          unitario: 10,
          total: 30,
        }}
      />
    );

    act(() => {
      fireEvent.change(screen.getByTestId("operaciones-line-0-unitario"), {
        target: { value: "5" },
      });
    });

    expect(screen.getByTestId("operaciones-line-0-total")).toHaveValue(15);
  });

  it("Al actualizar el total, se actualiza el precio unitario manteniendo la cantidad", () => {
    render(
      <Wrapper
        initial={{
          id: "l1",
          stockId: "p1",
          cantidad: 3,
          unitario: 10,
          total: 30,
        }}
      />
    );

    act(() => {
      fireEvent.change(screen.getByTestId("operaciones-line-0-total"), {
        target: { value: "100" },
      });
    });

    expect(screen.getByTestId("operaciones-line-0-unitario")).toHaveValue(33.33);
  });

  it("Permite ingresar una cantidad a entregar mayor a la cantidad pactada sin clampearla y marca el campo como inválido", () => {
    render(
      <Wrapper
        initial={{
          id: "l1",
          stockId: "p1",
          cantidad: 3,
          cantidadEntregar: 3,
          unitario: 10,
          total: 30,
        }}
      />
    );

    const entregarInput = screen.getByTestId("operaciones-line-0-cantidad-entregar");
    expect(entregarInput).toHaveAttribute("aria-invalid", "false");

    act(() => {
      fireEvent.change(entregarInput, {
        target: { value: "5" },
      });
    });

    expect(entregarInput).toHaveValue(5);
    expect(entregarInput).toHaveAttribute("aria-invalid", "true");
  });

  it("Sincroniza cantidadEntregar al cambiar cantidad si estaban iguales", () => {
    render(
      <Wrapper
        initial={{
          id: "l1",
          stockId: "p1",
          cantidad: 2,
          cantidadEntregar: 2,
          unitario: 10,
          total: 20,
        }}
      />
    );

    act(() => {
      fireEvent.change(screen.getByTestId("operaciones-line-0-cantidad"), {
        target: { value: "4" },
      });
    });

    expect(screen.getByTestId("operaciones-line-0-cantidad-entregar")).toHaveValue(4);
  });

  it("En formato móvil colapsado, muestra el botón de resumen y activa toggle", () => {
    const onMobileToggle = vi.fn();
    render(
      <OperacionLineaEditor
        index={0}
        linea={{ id: "l1", stockId: "p1", cantidad: 1, unitario: 100, total: 100 }}
        disabled={false}
        loadingStocks={false}
        stockOptions={[{ value: "p1", label: "Filtro de Aceite" }]}
        onChange={vi.fn()}
        mobileExpanded={false}
        onMobileToggle={onMobileToggle}
      />
    );

    const summaryBtn = screen.getByTestId("operaciones-line-0-summary");
    expect(summaryBtn).toBeInTheDocument();
    fireEvent.click(summaryBtn);
    expect(onMobileToggle).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("operaciones-line-0-expanded-header")).not.toBeInTheDocument();
  });

  it("En formato móvil extendido, muestra el tacho de basura para eliminar y el botón Confirmar para cerrar", () => {
    const onRemove = vi.fn();
    const onMobileConfirm = vi.fn();
    render(
      <OperacionLineaEditor
        index={0}
        linea={{ id: "l1", stockId: "p1", cantidad: 1, unitario: 100, total: 100 }}
        disabled={false}
        loadingStocks={false}
        stockOptions={[{ value: "p1", label: "Filtro de Aceite" }]}
        onChange={vi.fn()}
        mobileExpanded={true}
        canMobileDelete={true}
        onRemove={onRemove}
        onMobileConfirm={onMobileConfirm}
      />
    );

    expect(screen.getByTestId("operaciones-line-0-expanded-header")).toBeInTheDocument();
    const deleteBtn = screen.getByTestId("operaciones-line-0-delete");
    expect(deleteBtn).toHaveAttribute("title", "Eliminar producto");

    fireEvent.click(deleteBtn);
    expect(onRemove).toHaveBeenCalledTimes(1);

    const confirmBtn = screen.getByTestId("operaciones-line-0-confirm");
    fireEvent.click(confirmBtn);
    expect(onMobileConfirm).toHaveBeenCalledTimes(1);
  });
});

