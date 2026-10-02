import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getArregloModalFecha,
  normalizeArregloObservaciones,
  parseCombustibleLeido,
  requiresFinancialAccountForRepuestos,
  resolveEsFacturableForCreate,
} from "./ArregloModal";

describe("getArregloModalFecha", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("usa la fecha local de hoy cuando se crea un arreglo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 16, 10, 30, 0));

    expect(getArregloModalFecha()).toBe("2026-05-16");
  });

  it("respeta la fecha inicial cuando se edita un arreglo", () => {
    expect(getArregloModalFecha("2026-03-19T12:00:00.000Z")).toBe("2026-03-19");
  });

  it.each(["2026-09-24T01:30:00.000Z", "2026-09-24T04:30:00.000Z"])(
    "preserva el día calendario al editar fechas cercanas a medianoche UTC (%s)",
    (fecha) => {
      expect(getArregloModalFecha(fecha)).toBe("2026-09-24");
    }
  );
});

describe("normalizeArregloObservaciones", () => {
  it("mantiene una cadena vacía al editar para eliminar las observaciones existentes", () => {
    expect(normalizeArregloObservaciones("   ", true)).toBe("");
  });

  it("omite una observación vacía al crear un arreglo", () => {
    expect(normalizeArregloObservaciones("   ", false)).toBeUndefined();
  });
});

describe("parseCombustibleLeido", () => {
  it("acepta porcentajes entre 0 y 100 y mantiene vacío como opcional", () => {
    expect(parseCombustibleLeido("0")).toBe(0);
    expect(parseCombustibleLeido("65")).toBe(65);
    expect(parseCombustibleLeido(" ")).toBeUndefined();
  });

  it("rechaza valores fuera del rango", () => {
    expect(parseCombustibleLeido("101")).toBeUndefined();
  });
});

describe("resolveEsFacturableForCreate", () => {
  it("forces false for BASE even when the form state is true", () => {
    expect(resolveEsFacturableForCreate(false, true)).toBe(false);
  });

  it("preserves the selected value for PRO", () => {
    expect(resolveEsFacturableForCreate(true, true)).toBe(true);
    expect(resolveEsFacturableForCreate(true, false)).toBe(false);
  });
});

describe("requiresFinancialAccountForRepuestos", () => {
  const mockInventario = [
    { id: "stock-1", stockActual: 10, costoUnitario: 1000 },
    { id: "stock-2", stockActual: 0, costoUnitario: 2000 },
    { id: "stock-cero", stockActual: 0, costoUnitario: 0 },
  ];

  it("devuelve false en modo edición", () => {
    const repuestos = [
      {
        id: "rep-1",
        tipo: "nuevo" as const,
        stock_id: "__nuevo_producto__",
        cantidad: 1,
        monto_unitario: 5000,
        nuevoProducto: { codigo: "N1", nombre: "Nuevo", precioCompra: 3000, precioVenta: 5000 },
        categoriaArregloId: null,
        empleadoId: null,
      },
    ];
    expect(requiresFinancialAccountForRepuestos(repuestos, mockInventario, true)).toBe(false);
  });

  it("devuelve false si la lista de repuestos está vacía", () => {
    expect(requiresFinancialAccountForRepuestos([], mockInventario, false)).toBe(false);
  });

  it("devuelve false para un repuesto nuevo sin cargo (precioCompra = 0)", () => {
    const repuestos = [
      {
        id: "rep-1",
        tipo: "nuevo" as const,
        stock_id: "__nuevo_producto__",
        cantidad: 1,
        monto_unitario: 5000,
        nuevoProducto: { codigo: "N1", nombre: "Nuevo", precioCompra: 0, precioVenta: 5000 },
        categoriaArregloId: null,
        empleadoId: null,
      },
    ];
    expect(requiresFinancialAccountForRepuestos(repuestos, mockInventario, false)).toBe(false);
  });

  it("devuelve true para un repuesto nuevo con cargo (precioCompra > 0)", () => {
    const repuestos = [
      {
        id: "rep-1",
        tipo: "nuevo" as const,
        stock_id: "__nuevo_producto__",
        cantidad: 1,
        monto_unitario: 5000,
        nuevoProducto: { codigo: "N1", nombre: "Nuevo", precioCompra: 2500, precioVenta: 5000 },
        categoriaArregloId: null,
        empleadoId: null,
      },
    ];
    expect(requiresFinancialAccountForRepuestos(repuestos, mockInventario, false)).toBe(true);
  });

  it("devuelve false para repuesto existente con stock suficiente aun cuando precioCompra > 0", () => {
    const repuestos = [
      {
        id: "rep-1",
        tipo: "existente" as const,
        stock_id: "stock-1", // stockActual = 10
        cantidad: 2,
        monto_unitario: 1500,
        precioCompra: 1000,
        categoriaArregloId: null,
        empleadoId: null,
      },
    ];
    expect(requiresFinancialAccountForRepuestos(repuestos, mockInventario, false)).toBe(false);
  });

  it("devuelve false para repuesto existente con faltante si ingresa sin cargo (precioCompra = 0)", () => {
    const repuestos = [
      {
        id: "rep-1",
        tipo: "existente" as const,
        stock_id: "stock-2", // stockActual = 0
        cantidad: 3,
        monto_unitario: 3500,
        precioCompra: 0,
        categoriaArregloId: null,
        empleadoId: null,
      },
    ];
    expect(requiresFinancialAccountForRepuestos(repuestos, mockInventario, false)).toBe(false);
  });

  it("devuelve true para repuesto existente con faltante y precioCompra > 0", () => {
    const repuestos = [
      {
        id: "rep-1",
        tipo: "existente" as const,
        stock_id: "stock-2", // stockActual = 0
        cantidad: 3,
        monto_unitario: 3500,
        precioCompra: 1800,
        categoriaArregloId: null,
        empleadoId: null,
      },
    ];
    expect(requiresFinancialAccountForRepuestos(repuestos, mockInventario, false)).toBe(true);
  });

  it("usa costoUnitario del stock si precioCompra no fue explicitado y hay faltante", () => {
    const repuestosConCosto = [
      {
        id: "rep-1",
        stock_id: "stock-2", // stockActual = 0, costoUnitario = 2000
        cantidad: 1,
        monto_unitario: 3500,
        categoriaArregloId: null,
        empleadoId: null,
      },
    ];
    expect(requiresFinancialAccountForRepuestos(repuestosConCosto, mockInventario, false)).toBe(true);

    const repuestosSinCosto = [
      {
        id: "rep-2",
        stock_id: "stock-cero", // stockActual = 0, costoUnitario = 0
        cantidad: 1,
        monto_unitario: 3500,
        categoriaArregloId: null,
        empleadoId: null,
      },
    ];
    expect(requiresFinancialAccountForRepuestos(repuestosSinCosto, mockInventario, false)).toBe(false);
  });

  it("devuelve true si hay al menos un repuesto con cargo entre varios sin cargo", () => {
    const repuestos = [
      {
        id: "rep-1",
        tipo: "nuevo" as const,
        stock_id: "__nuevo_producto__",
        cantidad: 1,
        monto_unitario: 5000,
        nuevoProducto: { codigo: "N1", nombre: "Sin Cargo", precioCompra: 0, precioVenta: 5000 },
        categoriaArregloId: null,
        empleadoId: null,
      },
      {
        id: "rep-2",
        tipo: "existente" as const,
        stock_id: "stock-2", // faltante
        cantidad: 2,
        monto_unitario: 4000,
        precioCompra: 1500, // con cargo
        categoriaArregloId: null,
        empleadoId: null,
      },
    ];
    expect(requiresFinancialAccountForRepuestos(repuestos, mockInventario, false)).toBe(true);
  });

  it("devuelve false si todos los repuestos con faltante o nuevos son sin cargo (costo 0)", () => {
    const repuestos = [
      {
        id: "rep-1",
        tipo: "nuevo" as const,
        stock_id: "__nuevo_producto__",
        cantidad: 1,
        monto_unitario: 5000,
        nuevoProducto: { codigo: "N1", nombre: "Sin Cargo", precioCompra: 0, precioVenta: 5000 },
        categoriaArregloId: null,
        empleadoId: null,
      },
      {
        id: "rep-2",
        tipo: "existente" as const,
        stock_id: "stock-1", // stock suficiente (10)
        cantidad: 2,
        monto_unitario: 4000,
        categoriaArregloId: null,
        empleadoId: null,
      },
      {
        id: "rep-3",
        tipo: "existente" as const,
        stock_id: "stock-2", // faltante pero costo 0
        cantidad: 2,
        monto_unitario: 4000,
        precioCompra: 0,
        categoriaArregloId: null,
        empleadoId: null,
      },
    ];
    expect(requiresFinancialAccountForRepuestos(repuestos, mockInventario, false)).toBe(false);
  });
});
