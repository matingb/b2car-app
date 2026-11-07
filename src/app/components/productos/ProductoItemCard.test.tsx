import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProductoItemCard from "./ProductoItemCard";
import type { Producto } from "@/app/providers/ProductosProvider";

const sampleProducto: Producto = {
  id: "prod-1",
  nombre: "Aceite 5W30",
  codigo: "ACE-1793189739394-XULFX",
  categorias: ["Aceites y Lubricantes"],
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
      stockActual: 33,
      stockDisponible: 25,
      stockReservado: 8,
      stockPendiente: 11,
      stockMinimo: 5,
      stockMaximo: 50,
      ultimaActualizacion: "01/11/2026",
      historialMovimientos: [],
    },
  ],
};

describe("ProductoItemCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza información básica: nombre, código, categoría, precio y costo", () => {
    const handleClick = vi.fn();
    render(<ProductoItemCard producto={sampleProducto} onClick={handleClick} />);

    expect(screen.getByText("Aceite 5W30")).toBeInTheDocument();
    expect(screen.getByText("ACE-1793189739394-XULFX")).toBeInTheDocument();
    expect(screen.getByText("Aceites y Lubricantes")).toBeInTheDocument();
    expect(screen.getByText("$6.500")).toBeInTheDocument();
    expect(screen.getByText("Costo $4.000")).toBeInTheDocument();
  });

  it("muestra el total acumulado de stock de todos los talleres cuando tallerId está vacío", () => {
    render(<ProductoItemCard producto={sampleProducto} tallerId="" onClick={vi.fn()} />);

    // Físico: 30 + 33 = 63
    expect(screen.getByTestId("stock-pill-fisico")).toHaveTextContent("Físico: 63");
    // Disponible: 25 + 25 = 50
    expect(screen.getByTestId("stock-pill-disponible")).toHaveTextContent("Disponible: 50");
    // Reservado: 5 + 8 = 13
    expect(screen.getByTestId("stock-pill-reservado")).toHaveTextContent("Reservado: 13");
    // Pendiente: 10 + 11 = 21
    expect(screen.getByTestId("stock-pill-pendiente")).toHaveTextContent("Pendiente: 21");

    // Ya no se muestra el cartel de taller en la tarjeta
    expect(screen.queryByTestId("producto-card-taller")).not.toBeInTheDocument();
    expect(screen.queryByText("Todos los talleres")).not.toBeInTheDocument();
  });

  it("permite al padre ocultar las etiquetas de stock con showStockTitles={false}", () => {
    render(
      <ProductoItemCard
        producto={sampleProducto}
        showStockTitles={false}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByTestId("stock-pill-fisico")).toHaveTextContent("63");
    expect(screen.getByTestId("stock-pill-fisico")).not.toHaveTextContent("Físico:");
    expect(screen.getByTestId("stock-pill-disponible")).toHaveTextContent("50");
    expect(screen.getByTestId("stock-pill-disponible")).not.toHaveTextContent("Disponible:");
  });

  it("muestra el stock puntual del taller seleccionado sin mostrar cartel de taller", () => {
    render(<ProductoItemCard producto={sampleProducto} tallerId="taller-1" onClick={vi.fn()} />);

    expect(screen.getByTestId("stock-pill-fisico")).toHaveTextContent("Físico: 30");
    expect(screen.getByTestId("stock-pill-disponible")).toHaveTextContent("Disponible: 25");
    expect(screen.getByTestId("stock-pill-reservado")).toHaveTextContent("Reservado: 5");
    expect(screen.getByTestId("stock-pill-pendiente")).toHaveTextContent("Pendiente: 10");

    expect(screen.queryByTestId("producto-card-taller")).not.toBeInTheDocument();
  });

  it("maneja productos sin stock mostrando 0 en todos los estados", () => {
    const productoSinStock: Producto = {
      ...sampleProducto,
      stocks: [],
    };

    render(<ProductoItemCard producto={productoSinStock} onClick={vi.fn()} />);

    expect(screen.getByTestId("stock-pill-fisico")).toHaveTextContent("Físico: 0");
    expect(screen.getByTestId("stock-pill-disponible")).toHaveTextContent("Disponible: 0");
    expect(screen.getByTestId("stock-pill-reservado")).toHaveTextContent("Reservado: 0");
    expect(screen.getByTestId("stock-pill-pendiente")).toHaveTextContent("Pendiente: 0");
  });

  it("dispara onClick al hacer clic en la tarjeta", () => {
    const handleClick = vi.fn();
    render(<ProductoItemCard producto={sampleProducto} onClick={handleClick} />);

    fireEvent.click(screen.getByTestId(`producto-item-${sampleProducto.id}`));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
