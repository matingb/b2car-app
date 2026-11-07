import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProductosTable from "./ProductosTable";
import type { Producto } from "@/app/providers/ProductosProvider";

const sampleProductos: Producto[] = [
  {
    id: "prod-1",
    nombre: "Aceite 5W30",
    codigo: "ACE-12345",
    categorias: ["Lubricantes"],
    talleresConStock: 2,
    precioUnitario: 6500,
    costoUnitario: 4000,
    showInStock: true,
    stocks: [
      {
        id: "stock-1",
        productoId: "prod-1",
        tallerId: "taller-1",
        stockActual: 30,
        stockDisponible: 25,
        stockReservado: 5,
        stockPendiente: 10,
        stockMinimo: 5,
        stockMaximo: 50,
        ultimaActualizacion: "01/11/2026",
        historialMovimientos: [],
      },
      {
        id: "stock-2",
        productoId: "prod-1",
        tallerId: "taller-2",
        stockActual: 20,
        stockDisponible: 15,
        stockReservado: 5,
        stockPendiente: 5,
        stockMinimo: 5,
        stockMaximo: 50,
        ultimaActualizacion: "01/11/2026",
        historialMovimientos: [],
      },
    ],
  },
  {
    id: "prod-2",
    nombre: "Filtro de Aire",
    codigo: "FLT-999",
    categorias: [],
    talleresConStock: 0,
    precioUnitario: 3200,
    costoUnitario: 1800,
    showInStock: true,
    stocks: [],
  },
];

describe("ProductosTable", () => {

  it("filtra el stock por tallerId cuando se provee", () => {
    render(
      <ProductosTable
        productos={sampleProductos}
        tallerId="taller-1"
        onProductoClick={vi.fn()}
      />
    );

    // Taller-1 únicamente: físico 30, disponible 25, reservado 5, pendiente 10
    expect(screen.getByTestId("row-fisico-prod-1")).toHaveTextContent("30");
    expect(screen.getByTestId("row-disponible-prod-1")).toHaveTextContent("25");
    expect(screen.getByTestId("row-reservado-prod-1")).toHaveTextContent("5");
    expect(screen.getByTestId("row-pendiente-prod-1")).toHaveTextContent("10");
  });

  it("muestra el icono particular de estado de stock para cada producto", () => {
    render(
      <ProductosTable
        productos={sampleProductos}
        onProductoClick={vi.fn()}
      />
    );

    // prod-1 tiene stock normal (stockActual > stockMinimo y <= stockMaximo)
    const iconProd1 = screen.getByTestId("stock-status-icon-prod-1");
    expect(iconProd1).toHaveAttribute("title", "Stock normal");

    // prod-2 no tiene stocks configurados
    const iconProd2 = screen.getByTestId("stock-status-icon-prod-2");
    expect(iconProd2).toHaveAttribute("title", "Sin stock configurado");
  });

  it("llama a onProductoClick al hacer clic en una fila", () => {
    const handleClick = vi.fn();
    render(
      <ProductosTable
        productos={sampleProductos}
        onProductoClick={handleClick}
      />
    );

    fireEvent.click(screen.getByTestId("producto-row-prod-1"));
    expect(handleClick).toHaveBeenCalledWith(sampleProductos[0]);
  });
});
