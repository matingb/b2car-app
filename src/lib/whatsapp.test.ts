import { describe, expect, it, vi } from "vitest";
import {
  buildArregloWhatsappMessage,
  buildTurnoWhatsappMessage,
  buildWhatsappAppLink,
  buildWhatsappWebLink,
  normalizeWhatsappPhone,
  openWhatsapp,
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
        {
          id: "d1",
          arreglo_id: "a1",
          descripcion: "Mano de obra",
          cantidad: 2,
          precio_hora_facturada: 1500,
          horas_facturadas: 1,
          horas_trabajadas: 1,
          categoria_arreglo_id: null,
          empleado_id: null,
        },
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
              categoria_arreglo_id: null,
              empleado_id: null,
              producto: { id: "p1", codigo: "FIL-001", nombre: "Filtro" },
            },
          ],
        },
      ],
    });

    const msg = buildArregloWhatsappMessage(data, "Taller Demo");

    expect(msg).toContain("👨‍🔧 *Servicios:*");
    expect(msg).toContain("• Mano de obra x2");
    expect(msg).toContain("$3.000"); // 1 hora * 2 * 1500

    expect(msg).toContain("📦 *Repuestos:*");
    expect(msg).toContain("• Filtro x1");
    expect(msg).toContain("$5.000"); // 1 * 5000
  });

  it("formato agrupado: renderiza items sin precios individuales pero con subtotales por rubro y total", () => {
    const data = createArregloDetalleData({
      arreglo: createArreglo({
        esta_pago: false,
        kilometraje_leido: 50000,
        observaciones: "Revisión 50k",
        precio_final: 0,
        vehiculo: createVehiculo({ id: "v1", patente: "ABC123" }),
      }),
      detalles: [
        {
          id: "d1",
          arreglo_id: "a1",
          descripcion: "Mano de obra",
          cantidad: 2,
          precio_hora_facturada: 1500,
          horas_facturadas: 1,
          horas_trabajadas: 1,
          categoria_arreglo_id: null,
          empleado_id: null,
        },
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
              categoria_arreglo_id: null,
              empleado_id: null,
              producto: { id: "p1", codigo: "FIL-001", nombre: "Filtro" },
            },
          ],
        },
      ],
    });

    const msg = buildArregloWhatsappMessage(data, {
      tenantName: "Taller Demo",
      mostrarDetalleItems: true,
      mostrarPreciosItems: false,
      mostrarSubtotales: true,
      mostrarTotal: true,
    });

    expect(msg).toContain("• Filtro x1");
    expect(msg).not.toContain("• Filtro x1 - $5.000");
    expect(msg).toContain("_Subtotal repuestos: $5.000_");

    expect(msg).toContain("• Mano de obra x2");
    expect(msg).not.toContain("• Mano de obra x2 - $3.000");
    expect(msg).toContain("_Subtotal mano de obra: $3.000_");

    expect(msg).toContain("*Total arreglo $8.000*");
  });

  it("sin detalle de ítems: no muestra los detalles de ítems, solo subtotales y total", () => {
    const data = createArregloDetalleData({
      arreglo: createArreglo({
        esta_pago: false,
        kilometraje_leido: 50000,
        observaciones: "Service",
        precio_final: 0,
        vehiculo: createVehiculo({ id: "v1", patente: "ABC123" }),
      }),
      detalles: [
        {
          id: "d1",
          arreglo_id: "a1",
          descripcion: "Cambio de correa y tensores",
          cantidad: 1,
          precio_hora_facturada: 20000,
          horas_facturadas: 1,
          horas_trabajadas: 1,
          categoria_arreglo_id: null,
          empleado_id: null,
        },
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
              monto_unitario: 35000,
              delta_cantidad: -1,
              created_at: "2026-01-01",
              categoria_arreglo_id: null,
              empleado_id: null,
              producto: { id: "p1", codigo: "COR-01", nombre: "Kit de distribución" },
            },
          ],
        },
      ],
    });

    const msg = buildArregloWhatsappMessage(data, {
      tenantName: "Taller Demo",
      mostrarDetalleItems: false,
      mostrarSubtotales: true,
      mostrarTotal: true,
    });

    expect(msg).not.toContain("Kit de distribución");
    expect(msg).not.toContain("Cambio de correa y tensores");
    expect(msg).toContain("💰 *Resumen:*");
    expect(msg).toContain("• Repuestos: $35.000");
    expect(msg).toContain("• Mano de obra: $20.000");
    expect(msg).toContain("*Total arreglo $55.000*");
  });

  it("sin precios ni totales: muestra lista de ítems pero sin montos ni total", () => {
    const data = createArregloDetalleData({
      arreglo: createArreglo({
        esta_pago: false,
        kilometraje_leido: 10000,
        precio_final: 15000,
        vehiculo: createVehiculo({ patente: "XYZ789" }),
      }),
      detalles: [
        {
          id: "d1",
          arreglo_id: "a1",
          descripcion: "Alineación y balanceo",
          cantidad: 1,
          precio_hora_facturada: 10000,
          horas_facturadas: 1,
          horas_trabajadas: 1,
          categoria_arreglo_id: null,
          empleado_id: null,
        },
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
              cantidad: 2,
              monto_unitario: 2500,
              delta_cantidad: -2,
              created_at: "2026-01-01",
              categoria_arreglo_id: null,
              empleado_id: null,
              producto: { id: "p1", codigo: "VAL-01", nombre: "Válvulas" },
            },
          ],
        },
      ],
    });

    const msg = buildArregloWhatsappMessage(data, {
      mostrarDetalleItems: true,
      mostrarPreciosItems: false,
      mostrarSubtotales: false,
      mostrarTotal: false,
    });

    expect(msg).toContain("• Alineación y balanceo");
    expect(msg).toContain("• Válvulas x2");
    expect(msg).not.toContain("$");
    expect(msg).not.toContain("Total arreglo");
  });

  it("sin precios individuales: muestra ítems sin precio y un único total final", () => {
    const data = createArregloDetalleData({
      arreglo: createArreglo({
        esta_pago: false,
        precio_final: 20000,
        vehiculo: createVehiculo({ patente: "XYZ789" }),
      }),
      detalles: [
        {
          id: "d1",
          arreglo_id: "a1",
          descripcion: "Mano de obra",
          cantidad: 1,
          precio_hora_facturada: 20000,
          horas_facturadas: 1,
          horas_trabajadas: 1,
          categoria_arreglo_id: null,
          empleado_id: null,
        },
      ],
    });

    const msg = buildArregloWhatsappMessage(data, {
      mostrarDetalleItems: true,
      mostrarPreciosItems: false,
      mostrarSubtotales: false,
      mostrarTotal: true,
    });

    expect(msg).toContain("• Mano de obra");
    expect(msg).not.toContain("• Mano de obra - $20.000");
    expect(msg).toContain("*Total arreglo $20.000*");
  });

  it("respeta flags incluirKm e incluirObservaciones en false", () => {
    const data = createArregloDetalleData({
      arreglo: createArreglo({
        kilometraje_leido: 99999,
        observaciones: "Esta es una observación privada",
        vehiculo: createVehiculo({ patente: "ABC123" }),
      }),
    });

    const msg = buildArregloWhatsappMessage(data, {
      incluirKm: false,
      incluirObservaciones: false,
    });

    expect(msg).not.toContain("⏱️ KM actual");
    expect(msg).not.toContain("📝 Observaciones:");
  });

  it("permite combinar flags booleanas directas (toggles)", () => {
    const data = createArregloDetalleData({
      arreglo: createArreglo({
        precio_final: 20000,
        vehiculo: createVehiculo({ patente: "ABC123" }),
      }),
      detalles: [
        {
          id: "d1",
          arreglo_id: "a1",
          descripcion: "Mano de obra",
          cantidad: 1,
          precio_hora_facturada: 20000,
          horas_facturadas: 1,
          horas_trabajadas: 1,
          categoria_arreglo_id: null,
          empleado_id: null,
        },
      ],
    });

    // Detalle prendido, Precios apagados, Subtotales prendidos, Total apagado
    const msg = buildArregloWhatsappMessage(data, {
      mostrarDetalleItems: true,
      mostrarPreciosItems: false,
      mostrarSubtotales: true,
      mostrarTotal: false,
    });

    expect(msg).toContain("• Mano de obra");
    expect(msg).not.toContain("• Mano de obra - $20.000");
    expect(msg).toContain("_Subtotal mano de obra: $20.000_");
    expect(msg).not.toContain("*Total arreglo");
  });

  it("cuando horas_facturadas !== 1, no expone horas ni horas_trabajadas", () => {
    const data = createArregloDetalleData({
      arreglo: createArreglo({
        precio_final: 25000,
        vehiculo: createVehiculo({ patente: "ABC123" }),
      }),
      detalles: [
        {
          id: "d1",
          arreglo_id: "a1",
          descripcion: "Alineación y rectificado",
          cantidad: 1,
          precio_hora_facturada: 10000,
          horas_facturadas: 2.5,
          horas_trabajadas: 4,
          categoria_arreglo_id: null,
          empleado_id: null,
        },
      ],
    });

    const msg = buildArregloWhatsappMessage(data, {
      mostrarDetalleItems: true,
      mostrarPreciosItems: true,
      mostrarSubtotales: true,
      mostrarTotal: true,
    });

    expect(msg).toContain("• Alineación y rectificado x1 - $25.000");
    expect(msg).not.toContain("hs");
    expect(msg).not.toContain("trabajadas");
    expect(msg).toContain("*Total arreglo $25.000*");
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
  it("devuelve null si no hay digitos validos", () => {
    expect(normalizeWhatsappPhone("----")).toBeNull();
  });
});

describe("buildWhatsappAppLink", () => {
  it("construye el link con protocolo whatsapp://", () => {
    const link = buildWhatsappAppLink("5491112345678", "Hola mundo!");
    expect(link).toBe("whatsapp://send?phone=5491112345678&text=Hola%20mundo!");
  });
});

describe("buildWhatsappWebLink", () => {
  it("construye el link para WhatsApp Web en escritorio", () => {
    const link = buildWhatsappWebLink("5491112345678", "Hola mundo!");
    expect(link).toContain("web.whatsapp.com/send?phone=5491112345678");
    expect(link).toContain("text=Hola%20mundo!");
  });
});

describe("openWhatsappWithFallback", () => {
  it("intenta abrir la app mediante link whatsapp:// y ejecuta fallback si la app no toma foco", () => {
    vi.useFakeTimers();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => ({} as Window));
    const onFallback = vi.fn();

    const clickedHrefs: string[] = [];
    const originalAppend = document.body.appendChild.bind(document.body);
    vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
      if (node instanceof HTMLAnchorElement) {
        clickedHrefs.push(node.href);
      }
      return originalAppend(node);
    });

    openWhatsapp("5491112345678", "Mensaje test", {
      onFallback,
      timeoutMs: 1000,
    });

    // Se intentó abrir la app
    expect(clickedHrefs.some((h) => h.startsWith("whatsapp://send"))).toBe(true);
    expect(openSpy).not.toHaveBeenCalled();
    expect(onFallback).not.toHaveBeenCalled();

    // Al pasar el tiempo sin blur, se ejecuta el fallback a la web
    vi.advanceTimersByTime(1000);
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledTimes(1);
    const [calledUrl] = openSpy.mock.calls[0]!;
    expect(String(calledUrl)).toContain("web.whatsapp.com/send?phone=5491112345678");

    vi.useRealTimers();
  });

  it("no ejecuta el fallback a la web si la app toma foco (blur de ventana)", () => {
    vi.useFakeTimers();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => ({} as Window));
    const onFallback = vi.fn();

    openWhatsapp("5491112345678", "Mensaje test", {
      onFallback,
      timeoutMs: 1000,
    });

    // Simulamos que la ventana pierde foco (la app nativa se abrió)
    window.dispatchEvent(new Event("blur"));

    vi.advanceTimersByTime(1000);
    expect(onFallback).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});

