import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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
  return <RemitoFacturaLineasSelector lineas={lineas} value={value} onChange={setValue} />;
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

  it("permite agregar una línea propia referenciada a un concepto de factura", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar ítem" }));
    fireEvent.click(screen.getByTestId("remito-linea-factura-2"));
    fireEvent.click(screen.getByTestId("remito-linea-factura-2-option-srv"));

    expect(screen.getByLabelText("Descripción del ítem 2")).toHaveValue("Mano de obra");
    expect(screen.getByLabelText("Cantidad del ítem 2")).toHaveValue(1);
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
