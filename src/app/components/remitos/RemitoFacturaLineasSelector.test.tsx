import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

function Harness({ onChange }: { onChange?: (value: SeleccionLineasFactura) => void }) {
  const [value, setValue] = useState(() => seleccionInicial(lineas));
  return (
    <RemitoFacturaLineasSelector
      lineas={lineas}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe("RemitoFacturaLineasSelector", () => {
  it("preselecciona solo bienes con disponible y deja servicios seleccionables", () => {
    expect(seleccionInicial(lineas)).toEqual({
      rep: { seleccionada: true, cantidad: 3, observaciones: "" },
      srv: { seleccionada: false, cantidad: 1, observaciones: "" },
      agotada: { seleccionada: false, cantidad: 0, observaciones: "" },
    });

    render(<Harness />);
    const servicio = within(screen.getByTestId("remito-factura-linea-srv")).getByRole("checkbox");
    expect(servicio).not.toBeChecked();
    expect(servicio).toBeEnabled();
  });

  it("deshabilita líneas totalmente remitidas", () => {
    render(<Harness />);
    const fila = screen.getByTestId("remito-factura-linea-agotada");
    expect(within(fila).getByRole("checkbox")).toBeDisabled();
    expect(within(fila).getByText("Totalmente remitida")).toBeInTheDocument();
  });

  it("limita la cantidad a remitir al disponible", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText("Cantidad a remitir de Filtro");

    fireEvent.change(input, { target: { value: "10" } });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      rep: expect.objectContaining({ cantidad: 3 }),
    }));
  });

  it("muestra cantidades sin precios ni importes", () => {
    const { container } = render(<Harness />);
    expect(container.textContent).not.toMatch(/\$|precio|subtotal|importe/i);
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "", "Código", "Descripción", "Facturada", "Remitida", "Disponible", "A remitir", "Observaciones",
    ]);
  });

  it("valida y arma el payload de las líneas elegidas", () => {
    const seleccion = seleccionInicial(lineas);
    expect(validarSeleccionFactura(lineas, seleccion)).toBeNull();
    expect(lineasFacturaPayload(lineas, seleccion)).toEqual([{ facturaLineaId: "rep", observaciones: null, cantidad: 3 }]);
    expect(validarSeleccionFactura(lineas, { ...seleccion, rep: { ...seleccion.rep, seleccionada: false } }))
      .toBe("Seleccioná al menos una línea de la factura.");
    expect(validarSeleccionFactura(lineas, { ...seleccion, rep: { ...seleccion.rep, cantidad: 0 } }))
      .toContain('La cantidad de "Filtro"');
  });
});
