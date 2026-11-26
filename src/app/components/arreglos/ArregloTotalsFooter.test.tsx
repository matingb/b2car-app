import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ArregloTotalsFooter from "./ArregloTotalsFooter";

describe("ArregloTotalsFooter", () => {
  it("muestra desglose con subtotal y descuento sin IVA, línea de IVA y total del arreglo cuando precios no incluyen IVA y hay descuento", () => {
    // Ejemplo: Subtotal neto 50.000, Descuento 5.000, Neto 45.000, IVA 21% 9.450, Total 54.450
    render(
      <ArregloTotalsFooter
        subtotalServicios={30000}
        subtotalRepuestos={15000}
        total={54450}
        subtotal={50000}
        descuento={5000}
        preciosIncluyenIva={false}
        precioSinIva={45000}
      />
    );

    // Indicadores a la izquierda
    expect(screen.getByText("Servicios (sin IVA):")).toBeInTheDocument();
    expect(screen.getByText("Productos (sin IVA):")).toBeInTheDocument();

    // Desglose a la derecha:
    // Subtotal no debe tener IVA aplicado
    expect(screen.getByText(/Subtotal:\s*\$50\.000/)).toBeInTheDocument();
    // Descuento no debe tener IVA aplicado
    expect(screen.getByText(/Descuento:\s*-\$5\.000/)).toBeInTheDocument();
    // Línea extra de IVA (54.450 - 45.000 = 9.450)
    expect(screen.getByText(/IVA:\s*\$9\.450/)).toBeInTheDocument();
    // Total del arreglo
    expect(screen.getByText("Total del arreglo")).toBeInTheDocument();
    expect(screen.getByText("$54.450")).toBeInTheDocument();
  });

  it("muestra subtotal, línea de IVA y total cuando no hay descuento pero precios no incluyen IVA", () => {
    render(
      <ArregloTotalsFooter
        subtotalServicios={50000}
        subtotalRepuestos={0}
        total={60500}
        subtotal={50000}
        descuento={0}
        preciosIncluyenIva={false}
        precioSinIva={50000}
      />
    );

    expect(screen.getByText(/Subtotal:\s*\$50\.000/)).toBeInTheDocument();
    expect(screen.queryByText(/Descuento:/)).not.toBeInTheDocument();
    expect(screen.getByText(/IVA:\s*\$10\.500/)).toBeInTheDocument();
    expect(screen.getByText("$60.500")).toBeInTheDocument();
  });

  it("calcula displaySubtotal a partir de precioSinIva + descuento si subtotal no fue provisto", () => {
    render(
      <ArregloTotalsFooter
        subtotalServicios={20000}
        subtotalRepuestos={0}
        total={24200}
        descuento={2000}
        preciosIncluyenIva={false}
        precioSinIva={20000}
      />
    );

    // Subtotal inferido: 20000 + 2000 = 22000
    expect(screen.getByText(/Subtotal:\s*\$22\.000/)).toBeInTheDocument();
    expect(screen.getByText(/Descuento:\s*-\$2\.000/)).toBeInTheDocument();
    expect(screen.getByText(/IVA:\s*\$4\.200/)).toBeInTheDocument();
    expect(screen.getByText("$24.200")).toBeInTheDocument();
  });

  it("muestra subtotal y descuento pero no IVA cuando los precios ya incluyen IVA", () => {
    render(
      <ArregloTotalsFooter
        subtotalServicios={10000}
        subtotalRepuestos={0}
        total={8000}
        subtotal={10000}
        descuento={2000}
        preciosIncluyenIva={true}
        precioSinIva={8000}
      />
    );

    expect(screen.getByText("Servicios:")).toBeInTheDocument();
    expect(screen.getByText("Productos:")).toBeInTheDocument();
    expect(screen.getByText(/Subtotal:\s*\$10\.000/)).toBeInTheDocument();
    expect(screen.getByText(/Descuento:\s*-\$2\.000/)).toBeInTheDocument();
    expect(screen.queryByText(/IVA:/)).not.toBeInTheDocument();
    expect(screen.getByText("$8.000")).toBeInTheDocument();
  });

  it("no muestra desglose cuando los precios incluyen IVA y no hay descuento", () => {
    render(
      <ArregloTotalsFooter
        subtotalServicios={10000}
        subtotalRepuestos={0}
        total={10000}
        subtotal={10000}
        descuento={0}
        preciosIncluyenIva={true}
      />
    );

    expect(screen.queryByText(/Subtotal:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Descuento:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/IVA:/)).not.toBeInTheDocument();
    expect(screen.getAllByText("$10.000").length).toBe(2);
  });

  it("muestra datos de cobro y saldo pendiente si existen pagos parciales", () => {
    render(
      <ArregloTotalsFooter
        subtotalServicios={50000}
        subtotalRepuestos={0}
        total={50000}
        totalCobrado={20000}
        saldoPendiente={30000}
      />
    );

    expect(screen.getByText(/Cobrado:\s*\$20\.000/)).toBeInTheDocument();
    expect(screen.getByText(/Pendiente:\s*\$30\.000/)).toBeInTheDocument();
  });
});
