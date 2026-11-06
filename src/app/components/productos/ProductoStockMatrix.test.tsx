import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import ProductoStockMatrix from "./ProductoStockMatrix";

describe("ProductoStockMatrix", () => {
  it("ofrece registrar operación solo para el taller con stock configurado", () => {
    const onRegisterOperation = vi.fn();
    const stock = {
      id: "S-1",
      productoId: "P-1",
      tallerId: "T-1",
      stockActual: 5,
      stockMinimo: 1,
      stockMaximo: 10,
      ultimaActualizacion: "27/08/2026",
      historialMovimientos: [],
    };
    const talleres = [
      { id: "T-1", nombre: "Taller Centro", ubicacion: "Centro" },
      { id: "T-2", nombre: "Taller Norte", ubicacion: "Norte" },
    ];

    render(
      <ProductoStockMatrix
        productoId="P-1"
        talleres={talleres}
        stocks={[stock]}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onRegisterOperation={onRegisterOperation}
      />
    );

    fireEvent.click(screen.getByTestId("producto-stock-S-1-registrar-operacion"));

    expect(onRegisterOperation).toHaveBeenCalledWith(stock, talleres[0]);
    expect(screen.getByRole("button", { name: "Registrar operación en Taller Centro" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar stock de Taller Centro" })).toBeInTheDocument();
  });

  it("muestra advertencia de ajuste al editar la cantidad de un stock configurado", () => {
    const stock = {
      id: "S-1",
      productoId: "P-1",
      tallerId: "T-1",
      stockActual: 5,
      stockMinimo: 1,
      stockMaximo: 10,
      ultimaActualizacion: "27/08/2026",
      historialMovimientos: [],
    };
    const talleres = [{ id: "T-1", nombre: "Taller Centro", ubicacion: "Centro" }];

    render(
      <ProductoStockMatrix
        productoId="P-1"
        talleres={talleres}
        stocks={[stock]}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onRegisterOperation={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Editar stock de Taller Centro" }));

    expect(screen.getByText("Editar la cantidad registra un ajuste")).toBeInTheDocument();
  });

  it("renderiza la tabla completa con todas las columnas en modo desktop", () => {
    const stock = {
      id: "S-1",
      productoId: "P-1",
      tallerId: "T-1",
      stockActual: 45,
      stockDisponible: 36,
      stockReservado: 9,
      stockPendiente: 10,
      stockMinimo: 10,
      stockMaximo: 100,
      ultimaActualizacion: "27/08/2026",
      historialMovimientos: [],
    };
    const talleres = [{ id: "T-1", nombre: "Sede Central", ubicacion: "Av. Corrientes 1234" }];

    render(
      <ProductoStockMatrix
        productoId="P-1"
        talleres={talleres}
        stocks={[stock]}
        layoutMode="table"
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onRegisterOperation={vi.fn()}
      />
    );

    // Encabezados de tabla
    expect(screen.getByText("TALLER / SUCURSAL")).toBeInTheDocument();
    expect(screen.getByText("FÍSICO")).toBeInTheDocument();
    expect(screen.getByText("DISPONIBLE")).toBeInTheDocument();
    expect(screen.getByText("RESERVADO")).toBeInTheDocument();
    expect(screen.getByText("PENDIENTE")).toBeInTheDocument();
    expect(screen.getByText("MÍN / MÁX")).toBeInTheDocument();
    expect(screen.getByText("NIVEL DE STOCK")).toBeInTheDocument();
    expect(screen.getByText("ACCIONES")).toBeInTheDocument();

    // Valores
    expect(screen.getByText("Sede Central")).toBeInTheDocument();
    expect(screen.getByText("Av. Corrientes 1234")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("36")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("10 / 100")).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();
  });

  it("renderiza taller sin stock con guiones y badge de pendiente de parámetros en tabla", () => {
    const talleres = [{ id: "T-2", nombre: "Sucursal Oeste", ubicacion: "Mitre 450" }];

    render(
      <ProductoStockMatrix
        productoId="P-1"
        talleres={talleres}
        stocks={[]}
        layoutMode="table"
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onRegisterOperation={vi.fn()}
      />
    );

    expect(screen.getByText("Sucursal Oeste")).toBeInTheDocument();
    expect(screen.getByText("Mitre 450")).toBeInTheDocument();
    expect(screen.getByText("Pendiente de parámetros")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(5);
    expect(
      screen.getByRole("button", { name: "Configurar stock en Sucursal Oeste" })
    ).toBeInTheDocument();
  });

  it("renderiza el modo Card con métricas abreviadas en tablet", () => {
    const stock = {
      id: "S-1",
      productoId: "P-1",
      tallerId: "T-1",
      stockActual: 45,
      stockDisponible: 36,
      stockReservado: 9,
      stockPendiente: 10,
      stockMinimo: 10,
      stockMaximo: 100,
      ultimaActualizacion: "27/08/2026",
      historialMovimientos: [],
    };
    const talleres = [{ id: "T-1", nombre: "Sede Central", ubicacion: "Av. Corrientes 1234" }];

    render(
      <ProductoStockMatrix
        productoId="P-1"
        talleres={talleres}
        stocks={[stock]}
        layoutMode="card"
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onRegisterOperation={vi.fn()}
      />
    );

    // No debe haber cabecera de tabla
    expect(screen.queryByText("TALLER / SUCURSAL")).not.toBeInTheDocument();

    // Taller info
    expect(screen.getByText("Sede Central")).toBeInTheDocument();
    expect(screen.getByText("Av. Corrientes 1234")).toBeInTheDocument();

    // Métricas de Card abreviadas
    expect(screen.getByText("FÍSICO")).toBeInTheDocument();
    expect(screen.getByText("DISP.")).toBeInTheDocument();
    expect(screen.getByText("RES.")).toBeInTheDocument();
    expect(screen.getByText("PEND.")).toBeInTheDocument();

    // Valores
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("36")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getAllByText("10").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("45%")).toBeInTheDocument();
  });

  it("renderiza taller sin stock con guiones y badge de pendiente en modo card", () => {
    const talleres = [{ id: "T-2", nombre: "Sucursal Oeste", ubicacion: "Mitre 450" }];

    render(
      <ProductoStockMatrix
        productoId="P-1"
        talleres={talleres}
        stocks={[]}
        layoutMode="card"
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onRegisterOperation={vi.fn()}
      />
    );

    expect(screen.getByText("Sucursal Oeste")).toBeInTheDocument();
    expect(screen.getByText("Mitre 450")).toBeInTheDocument();
    expect(screen.getByText("Pendiente de parámetros")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(4);
    expect(
      screen.getByRole("button", { name: "Configurar stock en Sucursal Oeste" })
    ).toBeInTheDocument();
  });

  it("permite guardar modificaciones de stock", async () => {
    const onSave = vi.fn().mockResolvedValue({ stock: {} });
    const stock = {
      id: "S-1",
      productoId: "P-1",
      tallerId: "T-1",
      stockActual: 5,
      stockMinimo: 1,
      stockMaximo: 10,
      ultimaActualizacion: "27/08/2026",
      historialMovimientos: [],
    };
    const talleres = [{ id: "T-1", nombre: "Taller Centro", ubicacion: "Centro" }];

    render(
      <ProductoStockMatrix
        productoId="P-1"
        talleres={talleres}
        stocks={[stock]}
        onSave={onSave}
        onDelete={vi.fn()}
        onRegisterOperation={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Editar stock de Taller Centro" }));

    const guardarBtn = screen.getByRole("button", { name: "Guardar" });
    await act(async () => {
      fireEvent.click(guardarBtn);
    });

    expect(onSave).toHaveBeenCalledWith({
      stockId: "S-1",
      productoId: "P-1",
      tallerId: "T-1",
      stockActual: 5,
      stockMinimo: 1,
      stockMaximo: 10,
    });
  });
});
