import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { RemitoFacturaLineaDisponible } from "@/lib/remitos/types";
import RemitoFacturaLineasSelector, {
  lineasFacturaPayload,
  seleccionInicial,
  validarSeleccionFactura,
  type SeleccionLineasFactura,
} from "./RemitoFacturaLineasSelector";

const lineas: RemitoFacturaLineaDisponible[] = [
  { id: "rep", ordinal: 1, origen: "REPUESTO", codigo: "FIL", descripcion: "Filtro", cantidadFacturada: 5, cantidadRemitida: 2, cantidadDisponible: 3 },
  { id: "srv", ordinal: 2, origen: "SERVICIO", codigo: null, descripcion: "Mano de obra", cantidadFacturada: 1, cantidadRemitida: 0, cantidadDisponible: 1 },
  { id: "agotada", ordinal: 3, origen: "VENTA", codigo: "BAT", descripcion: "Batería", cantidadFacturada: 1, cantidadRemitida: 1, cantidadDisponible: 0 },
];

function Harness() {
  const [value, setValue] = useState(() => seleccionInicial(lineas));
  return <>
    <RemitoFacturaLineasSelector lineas={lineas} value={value} onChange={setValue} />
    <output data-testid="payload">{JSON.stringify(lineasFacturaPayload(value))}</output>
    <output data-testid="validacion">{validarSeleccionFactura(lineas, value)}</output>
  </>;
}

describe("RemitoFacturaLineasSelector", () => {
  it("precarga bienes disponibles como detalle editable del remito", () => {
    expect(seleccionInicial(lineas).map(({ facturaLineaId, codigo, descripcion, cantidad }) => ({
      facturaLineaId, codigo, descripcion, cantidad,
    }))).toEqual([{ facturaLineaId: "rep", codigo: "FIL", descripcion: "Filtro", cantidad: 3 }]);

    render(<Harness />);
    expect(screen.getByLabelText("Descripción del ítem 1")).toHaveValue("Filtro");
    expect(screen.getByLabelText("Código del ítem 1")).toHaveValue("FIL");
    expect(screen.getByText("Facturada 5 · Disponible 3")).toBeInTheDocument();
  });

  it("permite elegir un concepto desde el mismo campo de descripción", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Agregar ítem" }));
    await userEvent.click(screen.getByLabelText("Descripción del ítem 2"));
    await userEvent.click(screen.getByText("Mano de obra"));

    expect(screen.getByLabelText("Descripción del ítem 2")).toHaveValue("Mano de obra");
    expect(screen.getByLabelText("Cantidad del ítem 2")).toHaveValue(1);
    expect(JSON.parse(screen.getByTestId("payload").textContent ?? "[]")[1].facturaLineaId).toBe("srv");
    expect(screen.queryByText("Referencia de factura")).not.toBeInTheDocument();
  });

  it("desvincula al escribir texto propio y vuelve a controlar al seleccionar un concepto", async () => {
    render(<Harness />);
    const descripcion = screen.getByLabelText("Descripción del ítem 1");
    fireEvent.change(screen.getByLabelText("Cantidad del ítem 1"), { target: { value: "8" } });
    expect(screen.getByTestId("validacion")).toHaveTextContent("no puede superar 3");

    await userEvent.click(descripcion);
    await userEvent.clear(descripcion);
    await userEvent.type(descripcion, "Entrega especial", { skipClick: true });
    await userEvent.tab();
    expect(descripcion).toHaveValue("Entrega especial");
    expect(screen.getByTestId("validacion")).toBeEmptyDOMElement();
    expect(JSON.parse(screen.getByTestId("payload").textContent ?? "[]")[0].facturaLineaId).toBeNull();

    await userEvent.click(descripcion);
    await userEvent.clear(descripcion);
    await userEvent.type(descripcion, "Filt", { skipClick: true });
    await userEvent.click(screen.getByText("Filtro"));
    expect(descripcion).toHaveValue("Filtro");
    expect(screen.getByTestId("validacion")).toHaveTextContent("no puede superar 3");
    expect(JSON.parse(screen.getByTestId("payload").textContent ?? "[]")[0].facturaLineaId).toBe("rep");
  });

  it("permite ítems libres, pero controla también los conceptos agotados", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Agregar ítem" }));
    const descripcion = screen.getByLabelText("Descripción del ítem 2");
    await userEvent.type(descripcion, "Filtro");
    await userEvent.tab();
    fireEvent.change(screen.getByLabelText("Cantidad del ítem 2"), { target: { value: "100" } });
    expect(screen.getByTestId("validacion")).toBeEmptyDOMElement();
    expect(JSON.parse(screen.getByTestId("payload").textContent ?? "[]")[1].facturaLineaId).toBeNull();

    await userEvent.click(descripcion);
    await userEvent.clear(descripcion);
    await userEvent.click(screen.getByText("Batería"));
    expect(screen.getByTestId("validacion")).toHaveTextContent("no puede superar 0");
  });

  it("valida el total acumulado por referencia y conserva el detalle propio en el payload", () => {
    const inicial = seleccionInicial(lineas);
    expect(validarSeleccionFactura(lineas, inicial)).toBeNull();
    expect(lineasFacturaPayload(inicial)).toEqual([{
      facturaLineaId: "rep",
      codigo: "FIL",
      descripcion: "Filtro",
      observaciones: null,
      cantidad: 3,
    }]);

    const dosCajas: SeleccionLineasFactura = [
      { ...inicial[0], descripcion: "Caja 1", cantidad: 2 },
      { ...inicial[0], key: "segunda", descripcion: "Caja 2", cantidad: 1 },
    ];
    expect(validarSeleccionFactura(lineas, dosCajas)).toBeNull();
    expect(validarSeleccionFactura(lineas, dosCajas.map((linea) => ({ ...linea, cantidad: 2 }))))
      .toContain("no puede superar 3");
    expect(document.body.textContent).not.toMatch(/\$|precio|importe/i);
  });
});
