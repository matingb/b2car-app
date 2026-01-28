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
      tipo="venta"
      linea={linea}
      disabled={false}
      loadingProductos={false}
      productoOptions={[]}
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
          productoId: "p1",
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
          productoId: "p1",
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
          productoId: "p1",
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
});

