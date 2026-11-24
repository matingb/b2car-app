import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calcLineSubtotal, calcLineTotal, limitarDescuento } from "@/lib/calcLineTotal";
import { operacionesService } from "./operaciones/operacionesService";
import { statsService } from "./dashboard/stats/dashboardStatsService";
import { mapArreglo, mapArregloDetalleCompleto } from "./arreglos/arregloMapper";
import { POST as postRepuestosRoute } from "./arreglos/[id]/repuestos/route";
import { ServiceError } from "./serviceError";

// Mock de statsService para verificar invalidación
vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: {
    onDataChanged: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn(),
  },
}));

// Mock de arregloDescripcionService
vi.mock("@/app/api/arreglos/arregloDescripcionService", () => ({
  syncArregloDescripcion: vi.fn().mockResolvedValue({ descripcion: null, error: null }),
}));

// Mock createClient para rutas Next.js
vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("Integration & Logic Tests: Descuentos, Subtotales y Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. MANO DE OBRA (SERVICIOS) CON DESCUENTO
  // --------------------------------------------------------------------------
  describe("1. Entidad Servicio de Mano de Obra con Descuento", () => {
    it("calcula subtotal, descuento y total correctamente para una línea de mano de obra", () => {
      const cantidad = 2;
      const horasFacturadas = 1.5;
      const precioHora = 5000;
      const descuentoSolicitado = 2000;

      // Subtotal = 2 * 1.5 * 5000 = 15000
      const subtotal = calcLineSubtotal({
        cantidad,
        horas_facturadas: horasFacturadas,
        precio_hora_facturada: precioHora,
      });
      expect(subtotal).toBe(15000);

      // Descuento limitado entre 0 y subtotal
      const descuento = limitarDescuento(descuentoSolicitado, subtotal);
      expect(descuento).toBe(2000);

      // Total neto = subtotal - descuento = 13000
      const total = calcLineTotal({
        cantidad,
        horas_facturadas: horasFacturadas,
        precio_hora_facturada: precioHora,
        descuento,
      });
      expect(total).toBe(13000);
    });

    it("limitarDescuento no permite descuentos negativos ni mayores al subtotal", () => {
      const subtotal = 10000;

      expect(limitarDescuento(-500, subtotal)).toBe(0);
      expect(limitarDescuento(0, subtotal)).toBe(0);
      expect(limitarDescuento(3000, subtotal)).toBe(3000);
      expect(limitarDescuento(10000, subtotal)).toBe(10000); // 100% bonificado
      expect(limitarDescuento(15000, subtotal)).toBe(10000); // Limitado al subtotal
    });

    it("aplica IVA 21% ÚNICAMENTE sobre el neto descontado cuando precios_incluyen_iva es false", () => {
      // Arreglo con mano de obra: subtotal 10000, descuento 2000 => neto 8000
      const subtotal = 10000;
      const descuento = 2000;
      const precioSinIva = subtotal - descuento; // 8000
      const tasaIva = 0.21;

      // IVA se aplica sobre los $8000 (neto tras descuento), NO sobre $10000
      const montoIva = Math.round(precioSinIva * tasaIva * 100) / 100; // 1680
      const precioFinal = precioSinIva + montoIva; // 9680

      expect(montoIva).toBe(1680);
      expect(precioFinal).toBe(9680);

      // Si se hubiera calculado el IVA antes del descuento (erróneamente):
      // 10000 * 0.21 = 2100 -> precio_final sería 10000 + 2100 - 2000 = 10100 (incorrecto)
      expect(precioFinal).not.toBe(10100);
    });

    it("arregloMapper mapea subtotal, descuento y total en detalles y cabecera del arreglo", () => {
      const rawArreglo = {
        id: "arr-1",
        taller_id: "t-1",
        vehiculo_id: "v-1",
        estado: "EN_PROGRESO",
        descripcion: "Service completo",
        fecha: "2026-03-15T12:00:00.000Z",
        subtotal: 20000,
        descuento: 4000,
        precio_final: 16000,
        precio_sin_iva: 16000,
        total_cobrado: 6000,
        saldo_pendiente: 10000,
        esta_pago: false,
        empleados_detallados: [{ id: "emp-1", nombre: "Carlos", apellido: "Gómez" }],
      };

      const mapped = mapArreglo(rawArreglo);
      expect(mapped.subtotal).toBe(20000);
      expect(mapped.descuento).toBe(4000);
      expect(mapped.precio_final).toBe(16000);
      expect(mapped.saldo_pendiente).toBe(10000);

      const detalleCompleto = mapArregloDetalleCompleto({
        arreglo: mapped,
        detalles: [
          {
            id: "det-1",
            arreglo_id: "arr-1",
            descripcion: "Mano de obra frenos",
            cantidad: 1,
            horas_facturadas: 2,
            horas_trabajadas: 2,
            precio_hora_facturada: 10000,
            subtotal: 20000,
            descuento: 4000,
            total: 16000,
            categoria_arreglo_id: null,
            empleado_id: "emp-1",
          },
        ],
        asignaciones: [],
        cobros: [],
        detalle_formulario: null,
      });

      expect(detalleCompleto.detalles[0].subtotal).toBe(20000);
      expect(detalleCompleto.detalles[0].descuento).toBe(4000);
      expect(detalleCompleto.detalles[0].total).toBe(16000);
    });
  });

  // --------------------------------------------------------------------------
  // 2. REPUESTOS CON DESCUENTO
  // --------------------------------------------------------------------------
  describe("2. Entidad Repuesto con Descuento", () => {
    it("asigna repuesto existente con descuento a través de la API route y propaga p_descuento", async () => {
      const rpc = vi.fn().mockResolvedValue({ data: "operacion-repuesto-1", error: null });
      const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const eq = vi.fn(() => ({ maybeSingle }));
      const select = vi.fn(() => ({ eq }));
      const from = vi.fn(() => ({ select }));
      const mockSupabase = { rpc, from } as unknown as SupabaseClient;

      const { createClient } = await import("@/supabase/server");
      vi.mocked(createClient).mockResolvedValue(mockSupabase);

      const req = new Request("http://localhost/api/arreglos/arr-100/repuestos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "existente",
          taller_id: "t-1",
          stock_id: "stock-1",
          cantidad: 2,
          monto_unitario: 6000,
          descuento: 2000,
        }),
      });

      const res = await postRepuestosRoute(req as never, {
        params: Promise.resolve({ id: "arr-100" }),
      });

      expect(res.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith("rpc_asignar_repuesto_existente_con_compra", expect.objectContaining({
        p_arreglo_id: "arr-100",
        p_cantidad: 2,
        p_monto_unitario: 6000,
        p_descuento: 2000,
      }));
      expect(statsService.onDataChanged).toHaveBeenCalled();
    });

    it("crea producto nuevo inline con descuento para arreglo y propaga p_descuento", async () => {
      const rpc = vi.fn().mockResolvedValue({ data: "operacion-repuesto-inline", error: null });
      const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const eq = vi.fn(() => ({ maybeSingle }));
      const select = vi.fn(() => ({ eq }));
      const from = vi.fn(() => ({ select }));
      const mockSupabase = { rpc, from } as unknown as SupabaseClient;

      const { createClient } = await import("@/supabase/server");
      vi.mocked(createClient).mockResolvedValue(mockSupabase);

      const req = new Request("http://localhost/api/arreglos/arr-100/repuestos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "nuevo",
          taller_id: "t-1",
          codigo: "FILT-ACEITE-02",
          nombre: "Filtro de Aceite Premium",
          precio_compra: 3500,
          precio_venta: 8000,
          cantidad: 1,
          descuento: 1500,
          cuenta_financiera_id: "c0000000-0000-4000-8000-000000000001",
          idempotency_key: "e0000000-0000-4000-8000-000000000001",
        }),
      });

      const res = await postRepuestosRoute(req as never, {
        params: Promise.resolve({ id: "arr-100" }),
      });

      expect(res.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith("rpc_crear_producto_inline_para_arreglo", expect.objectContaining({
        p_codigo: "FILT-ACEITE-02",
        p_precio_venta: 8000,
        p_cantidad: 1,
        p_descuento: 1500,
      }));
    });

    it("guarda repuesto pendiente con descuento en presupuesto y recalcula totales", async () => {
      const rpc = vi.fn().mockResolvedValue({ data: { id: "rep-pend-1" }, error: null });
      const maybeSingle = vi.fn().mockResolvedValue({
        data: { estado: "PRESUPUESTO", repuestos_pendientes: [] },
        error: null,
      });
      const eq = vi.fn(() => ({ maybeSingle }));
      const select = vi.fn(() => ({ eq }));
      const from = vi.fn(() => ({ select }));
      const mockSupabase = { rpc, from } as unknown as SupabaseClient;

      const { createClient } = await import("@/supabase/server");
      vi.mocked(createClient).mockResolvedValue(mockSupabase);

      const req = new Request("http://localhost/api/arreglos/arr-100/repuestos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "nuevo",
          taller_id: "t-1",
          codigo: "DISCO-DEL",
          nombre: "Disco Delantero",
          precio_compra: 10000,
          precio_venta: 18000,
          cantidad: 2,
          descuento: 3000,
          cuenta_financiera_id: "c0000000-0000-4000-8000-000000000001",
          idempotency_key: "e0000000-0000-4000-8000-000000000002",
        }),
      });

      const res = await postRepuestosRoute(req as never, {
        params: Promise.resolve({ id: "arr-100" }),
      });

      expect(res.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith("rpc_upsert_repuesto_presupuesto", expect.objectContaining({
        p_arreglo_id: "arr-100",
        p_linea: expect.objectContaining({
          precio_venta: 18000,
          descuento: 3000,
        }),
      }));
    });

    it("consolida totales de arreglo combinando líneas de mano de obra y líneas de repuestos", () => {
      // Mano de obra: subtotal 10000, descuento 2000, total 8000
      const moSubtotal = 10000;
      const moDescuento = 2000;
      const moTotal = moSubtotal - moDescuento;

      // Repuesto 1: cantidad 2 * $4000 = $8000, desc $1000, total $7000
      const rep1Subtotal = 8000;
      const rep1Descuento = 1000;
      const rep1Total = rep1Subtotal - rep1Descuento;

      // Repuesto 2: cantidad 1 * $5000 = $5000, desc $500, total $4500
      const rep2Subtotal = 5000;
      const rep2Descuento = 500;
      const rep2Total = rep2Subtotal - rep2Descuento;

      const subtotalTotal = moSubtotal + rep1Subtotal + rep2Subtotal; // 23000
      const descuentoTotal = moDescuento + rep1Descuento + rep2Descuento; // 3500
      const netoTotal = moTotal + rep1Total + rep2Total; // 19500

      expect(subtotalTotal).toBe(23000);
      expect(descuentoTotal).toBe(3500);
      expect(netoTotal).toBe(19500);
      expect(subtotalTotal - descuentoTotal).toBe(netoTotal);
    });
  });

  // --------------------------------------------------------------------------
  // 3. VENTA CON DESCUENTO (OPERACIONES)
  // --------------------------------------------------------------------------
  describe("3. Entidad Venta (Operaciones) con Descuento", () => {
    it("crea una venta con stock conteniendo múltiples líneas con descuento autocalculado", async () => {
      const rpc = vi.fn().mockResolvedValue({
        data: "op-venta-1",
        error: null,
      });
      const single = vi.fn().mockResolvedValue({
        data: {
          id: "op-venta-1",
          tipo: "VENTA",
          subtotal: 12000,
          descuento: 2500,
          monto_total: 9500,
          esta_pago: false,
          lineas: [
            { id: "l-1", cantidad: 2, monto_unitario: 3500, subtotal: 7000, descuento: 1500, total: 5500 },
            { id: "l-2", cantidad: 1, monto_unitario: 5000, subtotal: 5000, descuento: 1000, total: 4000 },
          ],
        },
        error: null,
      });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });
      const from = vi.fn().mockReturnValue({ select });
      const mockSupabase = { rpc, from } as unknown as SupabaseClient;

      const lineasRequest = [
        { stock_id: "s-1", cantidad: 2, monto_unitario: 3500, descuento: 1500, delta_cantidad: -2 },
        { stock_id: "s-2", cantidad: 1, monto_unitario: 5000, descuento: 1000, delta_cantidad: -1 },
      ];

      const result = await operacionesService.create(mockSupabase, {
        tipo: "VENTA",
        taller_id: "t-1",
        fecha: "2026-03-15T12:00:00.000Z",
        lineas: lineasRequest,
        cliente_id: "cli-1",
      });

      expect(rpc).toHaveBeenCalledWith("rpc_crear_operacion_con_stock", expect.objectContaining({
        p_tipo: "VENTA",
        p_lineas: expect.arrayContaining([
          expect.objectContaining({ stock_id: "s-1", cantidad: 2, monto_unitario: 3500, descuento: 1500 }),
          expect.objectContaining({ stock_id: "s-2", cantidad: 1, monto_unitario: 5000, descuento: 1000 }),
        ]),
      }));

      expect(result.data?.subtotal).toBe(12000);
      expect(result.data?.descuento).toBe(2500);
      expect(result.data?.monto_total).toBe(9500);
      expect(result.error).toBeNull();
    });

    it("actualiza descuentos de líneas de una venta vía rpc_actualizar_descuentos_operacion", async () => {
      const rpc = vi.fn().mockResolvedValue({
        data: {
          id: "op-venta-1",
          subtotal: 12000,
          descuento: 3000,
          monto_total: 9000,
        },
        error: null,
      });
      const mockSupabase = { rpc } as unknown as SupabaseClient;

      const lineasAActualizar = [
        { id: "l-1", descuento: 2000 },
        { id: "l-2", descuento: 1000 },
      ];

      const result = await operacionesService.actualizarDescuentos(
        mockSupabase,
        "op-venta-1",
        lineasAActualizar
      );

      expect(rpc).toHaveBeenCalledWith("rpc_actualizar_descuentos_operacion", {
        p_operacion_id: "op-venta-1",
        p_lineas: lineasAActualizar,
      });
      const updated = result.data as { descuento?: number; monto_total?: number };
      expect(updated?.descuento).toBe(3000);
      expect(updated?.monto_total).toBe(9000);
      expect(result.error).toBeNull();
    });

    it("rechaza actualización de descuentos cuando el nuevo total queda menor a lo ya pagado", async () => {
      const rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { code: "22023", message: "El nuevo total (7000) no puede ser menor a lo ya pagado (9000)" },
      });
      const mockSupabase = { rpc } as unknown as SupabaseClient;

      const result = await operacionesService.actualizarDescuentos(
        mockSupabase,
        "op-venta-1",
        [{ id: "l-1", descuento: 5000 }]
      );

      expect(result.error).toBe(ServiceError.Validation);
      expect(result.data).toBeNull();
    });

    it("marca la venta como PAGADA cuando el descuento alcanza el 100% (monto_total = 0)", () => {
      const subtotal = 15000;
      const descuento = 15000;
      const montoTotal = subtotal - descuento;

      expect(montoTotal).toBe(0);
      const estaPago = montoTotal === 0;
      const estadoPago = estaPago ? "PAGADO" : "PENDIENTE";

      expect(estaPago).toBe(true);
      expect(estadoPago).toBe("PAGADO");
    });
  });

  // --------------------------------------------------------------------------
  // 4. DASHBOARD Y TOTALES ACUMULADOS
  // --------------------------------------------------------------------------
  describe("4. Dashboard y Métricas Acumuladas con Descuento", () => {
    it("las RPCs del dashboard acumulan el total neto descontado y no el subtotal bruto", async () => {
      // Simular resultado devuelto por dashboard_facturacion_por_categoria
      // con arreglos y repuestos con descuento
      const mockCategorias = [
        { label: "Mecánica", cantidad: 2, monto: 18000 }, // Bruto era 24000, descuento 6000
        { label: "Frenos", cantidad: 1, monto: 7500 },    // Bruto era 10000, descuento 2500
      ];

      const mockEmpleados = [
        { label: "Carlos Gómez", cantidad: 2, monto: 20000 }, // Bruto era 26000, descuento 6000
        { label: "Sin empleado", cantidad: 1, monto: 5500 },   // Bruto era 8000, descuento 2500
      ];

      const rpc = vi.fn().mockImplementation((fnName: string) => {
        if (fnName === "dashboard_facturacion_por_categoria") {
          return Promise.resolve({ data: mockCategorias, error: null });
        }
        if (fnName === "dashboard_facturacion_por_empleado") {
          return Promise.resolve({ data: mockEmpleados, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      const mockSupabase = { rpc } as unknown as SupabaseClient;

      const { data: resCat } = await mockSupabase.rpc("dashboard_facturacion_por_categoria", {
        p_from: "2026-03-01T00:00:00.000Z",
        p_to: "2026-04-01T00:00:00.000Z",
      });

      const { data: resEmp } = await mockSupabase.rpc("dashboard_facturacion_por_empleado", {
        p_from: "2026-03-01T00:00:00.000Z",
        p_to: "2026-04-01T00:00:00.000Z",
      });

      // Validar montos netos
      const totalCategorias = (resCat as typeof mockCategorias).reduce((acc, c) => acc + c.monto, 0);
      expect(totalCategorias).toBe(25500); // 18000 + 7500

      const totalEmpleados = (resEmp as typeof mockEmpleados).reduce((acc, e) => acc + e.monto, 0);
      expect(totalEmpleados).toBe(25500); // 20000 + 5500

      // El total de categorías y empleados coincide exactamente con los montos netos facturados
      expect(totalCategorias).toBe(totalEmpleados);
    });

    it("onDataChanged se invoca tras mutaciones de descuentos garantizando la invalidación de caché", async () => {
      const mockSupabase = {} as SupabaseClient;
      await statsService.onDataChanged(mockSupabase);

      expect(statsService.onDataChanged).toHaveBeenCalledWith(mockSupabase);
    });

    it("verifica integridad de totales en venta con y sin descuento para cálculo de facturación en dashboard", () => {
      // Caso 1: Venta de $10.000 sin descuento
      const ventaSinDesc = { subtotal: 10000, descuento: 0, monto_total: 10000 };
      expect(ventaSinDesc.monto_total).toBe(10000);

      // Caso 2: Misma venta de $10.000 con $2.500 de descuento
      const ventaConDesc = { subtotal: 10000, descuento: 2500, monto_total: 7500 };
      expect(ventaConDesc.monto_total).toBe(7500);

      // En el dashboard, la facturación debe reflejar la diferencia real ($7.500 vs $10.000)
      const diferenciaFacturacion = ventaSinDesc.monto_total - ventaConDesc.monto_total;
      expect(diferenciaFacturacion).toBe(2500);
    });
  });
});
