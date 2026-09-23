import { describe, expect, it } from "vitest";
import { mapArreglo, mapArregloDetalleCompleto } from "./arregloMapper";
import type { ArregloDetalleData } from "./arregloCompletoService";

describe("arregloMapper", () => {
  const baseRawArreglo = {
    id: "a1",
    taller_id: "t1",
    vehiculo_id: "v1",
    estado: "EN_PROGRESO",
    descripcion: "Frenos y disco",
    kilometraje_leido: 50000,
    fecha: "2026-03-01T10:00:00.000Z",
    observaciones: "Ninguna",
    precio_final: 12000,
    precio_sin_iva: 9917.36,
    total_cobrado: 5000,
    saldo_pendiente: 7000,
    esta_pago: false,
    empleados_detallados: [{ id: "emp1", nombre: "Carlos", apellido: "Gómez" }],
    facturas_electronicas: [
      { id: "fe1", estado: "PENDIENTE", numero_comprobante: 1 },
      { id: "fe2", estado: "AUTORIZADA", numero_comprobante: 2 },
    ],
  };

  describe("mapArreglo", () => {
    it("mapea los campos correctamente y conserva precios si hidePrices es false", () => {
      const result = mapArreglo(baseRawArreglo, { hidePrices: false });

      expect(result.id).toBe("a1");
      expect(result.precio_final).toBe(12000);
      expect(result.precio_sin_iva).toBe(9917.36);
      expect(result.total_cobrado).toBe(5000);
      expect(result.saldo_pendiente).toBe(7000);
      expect(result.empleados).toEqual([{ id: "emp1", nombre: "Carlos", apellido: "Gómez" }]);
      expect(result.factura_electronica).toEqual({ id: "fe2", estado: "AUTORIZADA", numero_comprobante: 2 });
    });

    it("redacta los montos a cero si hidePrices es true", () => {
      const result = mapArreglo(baseRawArreglo, { hidePrices: true });

      expect(result.id).toBe("a1");
      expect(result.precio_final).toBe(0);
      expect(result.precio_sin_iva).toBe(0);
      expect(result.total_cobrado).toBe(0);
      expect(result.saldo_pendiente).toBe(0);
      // Los datos no monetarios deben preservarse
      expect(result.descripcion).toBe("Frenos y disco");
      expect(result.empleados).toHaveLength(1);
      expect(result.factura_electronica?.estado).toBe("AUTORIZADA");
    });

    it("calcula saldo_pendiente si no viene explícito", () => {
      const withoutSaldo = {
        ...baseRawArreglo,
        saldo_pendiente: undefined,
      };
      const result = mapArreglo(withoutSaldo, { hidePrices: false });
      expect(result.saldo_pendiente).toBe(7000);
    });
  });

  describe("mapArregloDetalleCompleto", () => {
    const mockDetalleData: ArregloDetalleData = {
      arreglo: mapArreglo(baseRawArreglo),
      detalles: [
        {
          id: "d1",
          arreglo_id: "a1",
          descripcion: "Cambio de pastillas",
          cantidad: 1,
          precio_hora_facturada: 4000,
          horas_facturadas: 1,
          horas_trabajadas: 1,
          categoria_arreglo_id: null,
          empleado_id: "emp1",
        },
      ],
      asignaciones: [
        {
          id: "op1",
          tipo: "EGRESO_STOCK",
          taller_id: "t1",
          created_at: "2026-03-01T10:00:00.000Z",
          lineas: [
            {
              id: "l1",
              operacion_id: "op1",
              stock_id: "s1",
              cantidad: 2,
              monto_unitario: 4000,
              delta_cantidad: -2,
              created_at: "2026-03-01T10:00:00.000Z",
              categoria_arreglo_id: null,
              empleado_id: "emp1",
              producto: {
                id: "p1",
                codigo: "PAST-01",
                nombre: "Pastillas de freno",
                precio_unitario: 4000,
                costo_unitario: 2500,
              },
            },
          ],
        },
      ],
      detalle_formulario: {
        id: "df1",
        arreglo_id: "a1",
        formulario_id: "form1",
        costo: 1500,
        metadata: [],
      },
      cobros: [
        {
          id: "c1",
          operacion_id: "op1",
          importe: 5000,
          cuenta_id: "cta1",
          cuenta_nombre: "Caja Chica",
          fecha: "2026-03-01",
          created_at: "2026-03-01T10:00:00.000Z",
        },
      ],
    };

    it("conserva precios y cobros cuando hidePrices es false", () => {
      const result = mapArregloDetalleCompleto(mockDetalleData, { hidePrices: false });

      expect(result.arreglo.precio_final).toBe(12000);
      expect(result.detalles[0].precio_hora_facturada).toBe(4000);
      expect(result.asignaciones[0].lineas[0].monto_unitario).toBe(4000);
      expect(result.asignaciones[0].lineas[0].producto?.precio_unitario).toBe(4000);
      expect(result.asignaciones[0].lineas[0].producto?.costo_unitario).toBe(2500);
      expect(result.detalle_formulario?.costo).toBe(1500);
      expect(result.cobros).toHaveLength(1);
    });

    it("redacta todos los precios, costos y cobros a cero/vacío cuando hidePrices es true", () => {
      const result = mapArregloDetalleCompleto(mockDetalleData, { hidePrices: true });

      expect(result.arreglo.precio_final).toBe(0);
      expect(result.arreglo.total_cobrado).toBe(0);
      expect(result.detalles[0].precio_hora_facturada).toBe(0);
      expect(result.asignaciones[0].lineas[0].monto_unitario).toBe(0);
      expect(result.asignaciones[0].lineas[0].producto?.precio_unitario).toBe(0);
      expect(result.asignaciones[0].lineas[0].producto?.costo_unitario).toBe(0);
      expect(result.detalle_formulario?.costo).toBe(0);
      expect(result.cobros).toEqual([]);
    });
  });
});
