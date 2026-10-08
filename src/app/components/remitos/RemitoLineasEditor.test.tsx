import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RemitoLineasEditor, { lineasLibresPayload, nuevaLineaLibre, type LineaLibreForm } from "./RemitoLineasEditor";

let ultimo: LineaLibreForm[] = [];

function Harness() {
  const [value, setValue] = useState<LineaLibreForm[]>(() => [nuevaLineaLibre()]);
  ultimo = value;
  return <RemitoLineasEditor value={value} onChange={setValue} />;
}

describe("RemitoLineasEditor", () => {
  it("permite agregar y quitar ítems manteniendo al menos uno", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Quitar ítem 1" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Agregar ítem" }));
    expect(screen.getAllByTestId("remito-linea-libre")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Quitar ítem 2" }));
    expect(screen.getAllByTestId("remito-linea-libre")).toHaveLength(1);
  });

  it("edita código, descripción, observaciones y cantidad sin precios", () => {
    const { container } = render(<Harness />);

    fireEvent.change(screen.getByLabelText("Código del ítem 1"), { target: { value: " A-1 " } });
    fireEvent.change(screen.getByLabelText("Descripción del ítem 1"), { target: { value: "Neumático" } });
    fireEvent.change(screen.getByLabelText("Observaciones del ítem 1"), { target: { value: "Con llanta" } });
    fireEvent.change(screen.getByLabelText("Cantidad del ítem 1"), { target: { value: "2.5" } });

    expect(lineasLibresPayload(ultimo)).toEqual([
      { facturaLineaId: null, codigo: "A-1", descripcion: "Neumático", observaciones: "Con llanta", cantidad: 2.5 },
    ]);
    expect(container.textContent).not.toMatch(/\$|precio|importe/i);
  });
});
