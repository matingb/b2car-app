import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OperacionActions from "./OperacionActions";

describe("OperacionActions", () => {
  it("muestra el disparador de factura y ejecuta su acción", () => {
    const onInvoice = vi.fn();
    const onDelete = vi.fn();

    render(
      <OperacionActions
        isGasto={false}
        deleteTitle="Eliminar venta"
        onInvoice={onInvoice}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Facturar electrónicamente" }));

    expect(onInvoice).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("muestra el disparador de remito solo cuando se provee la acción", () => {
    const onRemito = vi.fn();
    const { rerender } = render(
      <OperacionActions isGasto={false} deleteTitle="Eliminar venta" onRemito={onRemito} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generar remito" }));
    expect(onRemito).toHaveBeenCalledTimes(1);

    rerender(<OperacionActions isGasto={false} deleteTitle="Eliminar venta" onDelete={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Generar remito" })).toBeNull();
  });
});
