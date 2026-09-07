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
});
