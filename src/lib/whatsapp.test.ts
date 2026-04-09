import { describe, expect, it } from "vitest";
import {
  buildArregloWhatsappMessage,
  buildTurnoWhatsappMessage,
  normalizeWhatsappPhone,
} from "@/lib/whatsapp";
import { createArreglo, createArregloDetalleData, createTurno, createVehiculo, createCliente } from "@/tests/factories";

describe("buildArregloWhatsappMessage", () => {
  it("no renderiza secciones/líneas opcionales si no hay datos", () => {
    const data = createArregloDetalleData({
      arreglo: createArreglo({
        vehiculo: createVehiculo({ patente: "ABC123" }),
        kilometraje_leido: 0,
        observaciones: "",
        precio_final: 0,
      }),
      detalles: [],
      asignaciones: [],
    });

    const msg = buildArregloWhatsappMessage(data, "Taller Demo");

    expect(msg).toContain("🚗 Patente ABC123");
    expect(msg).toContain("Total arreglo");

    expect(msg).not.toContain("⏱️ KM actual");
    expect(msg).not.toContain("📝 Observaciones:");
    expect(msg).not.toContain("👨‍🔧 *Servicios:*");
    expect(msg).not.toContain("📦 *Repuestos:*");
  });

  it("si hay servicios y repuestos, renderiza ambas secciones con sus líneas", () => {
    const data = createArregloDetalleData({
      arreglo: createArreglo({
        esta_pago: false,
        descripcion: "Cambio de aceite",
        kilometraje_leido: 123456,
        observaciones: "Revisar filtro",
        precio_final: 0,
        vehiculo: createVehiculo({ id: "v1", patente: "ABC123" }),
      }),
      detalles: [
        { id: "d1", arreglo_id: "a1", descripcion: "Mano de obra", cantidad: 2, valor: 1500 },
      ],
      asignaciones: [
        {
          id: "op1",
          tipo: "egreso",
          taller_id: "t1",
          created_at: "2026-01-01",
          lineas: [
            {
              id: "l1",
              operacion_id: "op1",
              stock_id: "s1",
              cantidad: 1,
              monto_unitario: 5000,
              delta_cantidad: -1,
              created_at: "2026-01-01",
              producto: { id: "p1", codigo: "FIL-001", nombre: "Filtro" },
            },
          ],
        },
      ],
    });

    const msg = buildArregloWhatsappMessage(data, "Taller Demo");

    expect(msg).toContain("👨‍🔧 *Servicios:*");
    expect(msg).toContain("• Mano de obra x2");
    expect(msg).toContain("$3.000"); // 2 * 1500

    expect(msg).toContain("📦 *Repuestos:*");
    expect(msg).toContain("• Filtro x1");
    expect(msg).toContain("$5.000"); // 1 * 5000
  });
});

describe("buildTurnoWhatsappMessage", () => {
  it("no renderiza líneas opcionales si faltan datos", () => {
    const turno = createTurno({
      cliente: createCliente({ nombre: "" }),
      vehiculo: undefined,
      duracion: null,
      descripcion: undefined,
      observaciones: undefined,
      fecha: "2026-02-11",
      hora: "10:30",
    });

    const msg = buildTurnoWhatsappMessage(turno, "Taller Demo");

    expect(msg).toContain("📅 Fecha: 2026-02-11");
    expect(msg).toContain("⏰ Hora: 10:30 hs");

    expect(msg).not.toContain("👤 ");
    expect(msg).not.toContain("🚗 ");
    expect(msg).not.toContain("⏱️ Duración:");
    expect(msg).not.toContain("📝 ");
    expect(msg).not.toContain("🗒️ Observaciones:");
  });

  it("si hay cliente, vehiculo y datos extra, los incluye en el mensaje", () => {
    const turno = createTurno({
      cliente: createCliente({ nombre: "Juan" }),
      vehiculo: createVehiculo({ marca: "Ford", modelo: "Fiesta", patente: "AA000BB" }),
      fecha: "2026-02-11",
      hora: "10:30",
      duracion: 60,
      descripcion: "Service",
      observaciones: "Llegar 10 min antes",
    });
    const msg = buildTurnoWhatsappMessage(turno, "Taller Demo");

    expect(msg).toContain("👤 Juan");
    expect(msg).toContain("🚗 AA000BB - Ford Fiesta");
    expect(msg).toContain("📅 Fecha: 2026-02-11");
    expect(msg).toContain("⏰ Hora: 10:30 hs");
    expect(msg).toContain("⏱️ Duración: 60 minutos");
    expect(msg).toContain("📝 Service");
    expect(msg).toContain("🗒️ Observaciones: Llegar 10 min antes");
  });
});

describe("normalizeWhatsappPhone", () => {
  it("agrega prefijo 54 cuando el numero no lo trae", () => {
    expect(normalizeWhatsappPhone("11 1234-5678")).toBe("541112345678");
  });

  it("mantiene el prefijo 54 cuando ya existe", () => {
    expect(normalizeWhatsappPhone("+54 9 11 1234-5678")).toBe("5491112345678");
  });

  it("devuelve null si no hay digitos validos", () => {
    expect(normalizeWhatsappPhone("----")).toBeNull();
  });
});

