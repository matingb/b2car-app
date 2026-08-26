import { describe, expect, it } from "vitest";
import { getOperacionTitle } from "./LineDetalleOperacion";
import type { Operacion } from "@/model/types";
import type { StockItem } from "@/model/stock";

describe("getOperacionTitle", () => {
  const stocksByIdMock: Record<string, StockItem> = {
    "stock-1": {
      id: "stock-1",
      nombre: "Aceite Castrol 10W40",
      codigo: "OIL-1040",
      tallerId: "taller-1",
      productoId: "prod-1",
      categorias: [],
      stockActual: 10,
      stockMinimo: 2,
      stockMaximo: 20,
      costoUnitario: 10000,
      precioUnitario: 15000,
      proveedor: "Castrol",
      showInStock: true,
      ultimaActualizacion: "2026-01-01",
      historialMovimientos: [],
    },
    "stock-2": {
      id: "stock-2",
      nombre: "Filtro de Aceite",
      codigo: "FLT-001",
      tallerId: "taller-1",
      productoId: "prod-2",
      categorias: [],
      stockActual: 5,
      stockMinimo: 1,
      stockMaximo: 10,
      costoUnitario: 3000,
      precioUnitario: 5000,
      proveedor: "Bosch",
      showInStock: true,
      ultimaActualizacion: "2026-01-01",
      historialMovimientos: [],
    },
  };

  it("devuelve la descripcion si la operacion ya la tiene (ej. Cobros, Gastos, o Asignación con auto)", () => {
    const operacion = {
      id: "op-1",
      tipo: "ASIGNACION_ARREGLO",
      taller_id: "taller-1",
      fecha: "2026-08-26",
      created_at: "2026-08-26",
      descripcion: "Asignación · Ford Focus (AA123BB)",
      lineas: [],
    } as unknown as Operacion;

    expect(getOperacionTitle(operacion, "Asignación", stocksByIdMock)).toBe(
      "Asignación · Ford Focus (AA123BB)"
    );
  });

  it("genera el titulo correcto para Compra con 1 producto (usando datos de linea)", () => {
    const operacion = {
      id: "op-2",
      tipo: "COMPRA",
      taller_id: "taller-1",
      fecha: "2026-08-26",
      created_at: "2026-08-26",
      lineas: [
        {
          id: "linea-1",
          operacion_id: "op-2",
          stock_id: "stock-1",
          cantidad: 2,
          monto_unitario: 15000,
          delta_cantidad: 2,
          created_at: "2026-08-26",
          nombre: "Aceite Castrol 10W40",
          codigo: "OIL-1040",
        },
      ],
    } as unknown as Operacion;

    expect(getOperacionTitle(operacion, "Compra", stocksByIdMock)).toBe(
      "Compra · Aceite Castrol 10W40 (x2)"
    );
  });

  it("genera el titulo correcto para Compra con multiples productos", () => {
    const operacion = {
      id: "op-3",
      tipo: "COMPRA",
      taller_id: "taller-1",
      fecha: "2026-08-26",
      created_at: "2026-08-26",
      lineas: [
        {
          id: "linea-1",
          operacion_id: "op-3",
          stock_id: "stock-1",
          cantidad: 1,
          monto_unitario: 15000,
          delta_cantidad: 1,
          created_at: "2026-08-26",
          nombre: "Aceite Castrol 10W40",
        },
        {
          id: "linea-2",
          operacion_id: "op-3",
          stock_id: "stock-2",
          cantidad: 1,
          monto_unitario: 5000,
          delta_cantidad: 1,
          created_at: "2026-08-26",
          nombre: "Filtro de Aceite",
        },
        {
          id: "linea-3",
          operacion_id: "op-3",
          stock_id: "stock-3",
          cantidad: 4,
          monto_unitario: 2000,
          delta_cantidad: 4,
          created_at: "2026-08-26",
          nombre: "Bujía",
        },
      ],
    } as unknown as Operacion;

    expect(getOperacionTitle(operacion, "Compra", stocksByIdMock)).toBe(
      "Compra · Aceite Castrol 10W40 + 2 más"
    );
  });

  it("genera el titulo correcto para Venta con fallback a stocksById", () => {
    const operacion = {
      id: "op-4",
      tipo: "VENTA",
      taller_id: "taller-1",
      fecha: "2026-08-26",
      created_at: "2026-08-26",
      lineas: [
        {
          id: "linea-1",
          operacion_id: "op-4",
          stock_id: "stock-2",
          cantidad: 1,
          monto_unitario: 8000,
          delta_cantidad: -1,
          created_at: "2026-08-26",
        },
      ],
    } as unknown as Operacion;

    expect(getOperacionTitle(operacion, "Venta", stocksByIdMock)).toBe(
      "Venta · Filtro de Aceite"
    );
  });

  it("devuelve tipoLabel por defecto si la operacion no tiene lineas ni descripcion", () => {
    const operacion = {
      id: "op-5",
      tipo: "COMPRA",
      taller_id: "taller-1",
      fecha: "2026-08-26",
      created_at: "2026-08-26",
      lineas: [],
    } as unknown as Operacion;

    expect(getOperacionTitle(operacion, "Compra", stocksByIdMock)).toBe("Compra");
  });
});
