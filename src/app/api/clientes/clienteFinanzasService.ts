import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClienteResumenFinanciero, ClienteMovimientoCuenta } from "@/model/types";
import { logger } from "@/lib/logger";

export interface CuentaCorrienteFilters {
  from?: string | null;
  to?: string | null;
}

export const clienteFinanzasService = {
  async getResumenFinanciero(
    supabase: SupabaseClient,
    clienteId: string
  ): Promise<{ data: ClienteResumenFinanciero | null; error: Error | null }> {
    if (!clienteId) {
      return { data: null, error: new Error("ID de cliente requerido") };
    }

    // 1. Intentar RPC primero
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "rpc_cliente_resumen_financiero",
      { p_cliente_id: clienteId }
    );

    if (!rpcError && rpcData) {
      const raw = rpcData as Record<string, unknown>;
      const data: ClienteResumenFinanciero = {
        saldo_cuenta: Number(raw.saldo_cuenta ?? 0),
        saldo_a_facturar: Number(raw.saldo_a_facturar ?? 0),
        total_historico_trabajos: Number(raw.total_historico_trabajos ?? 0),
        total_historico_cobrado: Number(raw.total_historico_cobrado ?? 0),
        cantidad_arreglos_pendientes_pago: Number(raw.cantidad_arreglos_pendientes_pago ?? 0),
        cantidad_arreglos_pendientes_factura: Number(raw.cantidad_arreglos_pendientes_factura ?? 0),
      };
      return { data, error: null };
    }

    // 2. Fallback si RPC no está disponible
    try {
      logger.warn("RPC rpc_cliente_resumen_financiero no disponible, ejecutando fallback:", rpcError?.message);

      const { data: vehiculos } = await supabase
        .from("vehiculos")
        .select("id")
        .eq("cliente_id", clienteId);
      const vehiculoIds = (vehiculos ?? []).map((v) => v.id);

      let query = supabase
        .from("arreglos")
        .select("id, precio_final, total_cobrado, esta_pago, estado, es_facturable, cliente_id, vehiculo_id")
        .neq("estado", "PRESUPUESTO");

      if (vehiculoIds.length > 0) {
        query = query.or(`cliente_id.eq.${clienteId},vehiculo_id.in.(${vehiculoIds.join(",")})`);
      } else {
        query = query.eq("cliente_id", clienteId);
      }

      const { data: arreglos, error: arreglosError } = await query;
      if (arreglosError) {
        return { data: null, error: new Error(arreglosError.message) };
      }

      const arregloRows = arreglos ?? [];
      const arregloIds = arregloRows.map((a) => a.id);

      const facturadosSet = new Set<string>();
      if (arregloIds.length > 0) {
        const { data: facturas } = await supabase
          .from("facturas_electronicas")
          .select("arreglo_id")
          .in("arreglo_id", arregloIds)
          .eq("estado", "AUTORIZADA");
        (facturas ?? []).forEach((f) => facturadosSet.add(f.arreglo_id));
      }

      let totalHistoricoTrabajos = 0;
      let totalHistoricoCobrado = 0;
      let saldoCuenta = 0;
      let saldoAFacturar = 0;
      let cantPendientesPago = 0;
      let cantPendientesFactura = 0;

      for (const a of arregloRows) {
        const precio = Number(a.precio_final ?? 0);
        const cobrado = Number(a.total_cobrado ?? 0);
        const facturable = a.es_facturable !== false;
        const estaPagado = a.esta_pago === true || (precio > 0 && cobrado >= precio);
        const pendienteCobro = Math.max(0, precio - cobrado);

        totalHistoricoTrabajos += precio;
        totalHistoricoCobrado += cobrado;
        saldoCuenta += pendienteCobro;

        if (!estaPagado && pendienteCobro > 0) {
          cantPendientesPago++;
        }

        const estaFacturado = facturadosSet.has(a.id);
        if (facturable && !estaFacturado && precio > 0) {
          saldoAFacturar += precio;
          cantPendientesFactura++;
        }
      }

      const fallbackData: ClienteResumenFinanciero = {
        saldo_cuenta: saldoCuenta,
        saldo_a_facturar: saldoAFacturar,
        total_historico_trabajos: totalHistoricoTrabajos,
        total_historico_cobrado: totalHistoricoCobrado,
        cantidad_arreglos_pendientes_pago: cantPendientesPago,
        cantidad_arreglos_pendientes_factura: cantPendientesFactura,
      };

      return { data: fallbackData, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error calculando resumen financiero";
      return { data: null, error: new Error(msg) };
    }
  },

  async getCuentaCorriente(
    supabase: SupabaseClient,
    clienteId: string,
    filters: CuentaCorrienteFilters = {}
  ): Promise<{ data: ClienteMovimientoCuenta[] | null; error: Error | null }> {
    if (!clienteId) {
      return { data: null, error: new Error("ID de cliente requerido") };
    }

    const { from = null, to = null } = filters;

    // 1. Intentar RPC
    const { data: rpcRows, error: rpcError } = await supabase.rpc(
      "rpc_cliente_cuenta_corriente",
      {
        p_cliente_id: clienteId,
        p_from: from,
        p_to: to,
      }
    );

    if (!rpcError && Array.isArray(rpcRows)) {
      const sortedAsc = [...rpcRows].sort(
        (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
      );

      let runningBalance = 0;
      const withBalance = sortedAsc.map((row) => {
        const debito = Number(row.debito ?? 0);
        const credito = Number(row.credito ?? 0);
        runningBalance += debito - credito;
        return {
          id: String(row.id),
          fecha: String(row.fecha),
          created_at: String(row.created_at ?? row.fecha),
          tipo_movimiento: String(row.tipo_movimiento),
          concepto: String(row.concepto ?? ""),
          comprobante: row.comprobante ? String(row.comprobante) : null,
          debito,
          credito,
          saldo_acumulado: runningBalance,
          arreglo_id: row.arreglo_id ? String(row.arreglo_id) : null,
          operacion_id: row.operacion_id ? String(row.operacion_id) : null,
          cuenta_nombre: row.cuenta_nombre ? String(row.cuenta_nombre) : null,
        } as ClienteMovimientoCuenta;
      });

      return { data: withBalance.reverse(), error: null };
    }

    // 2. Fallback
    try {
      logger.warn("RPC rpc_cliente_cuenta_corriente no disponible, ejecutando fallback:", rpcError?.message);

      const { data: vehiculos } = await supabase
        .from("vehiculos")
        .select("id, patente")
        .eq("cliente_id", clienteId);
      const vehiculoMap = new Map<string, string>();
      (vehiculos ?? []).forEach((v) => vehiculoMap.set(v.id, v.patente));
      const vehiculoIds = Array.from(vehiculoMap.keys());

      let query = supabase
        .from("arreglos")
        .select("id, fecha, created_at, descripcion, precio_final, vehiculo_id, esta_pago")
        .neq("estado", "PRESUPUESTO");

      if (vehiculoIds.length > 0) {
        query = query.or(`cliente_id.eq.${clienteId},vehiculo_id.in.(${vehiculoIds.join(",")})`);
      } else {
        query = query.eq("cliente_id", clienteId);
      }

      if (from) {
        query = query.gte("fecha", from);
      }
      if (to) {
        query = query.lte("fecha", to);
      }

      const { data: arreglos, error: arreglosErr } = await query;
      if (arreglosErr) {
        return { data: null, error: new Error(arreglosErr.message) };
      }

      const arregloRows = arreglos ?? [];
      const arregloIds = arregloRows.map((a) => a.id);

      let cobrosRows: Array<{
        operacion_id: string;
        arreglo_id: string;
        created_at: string;
        operacion?: { fecha?: string };
        movimiento?: { importe?: number; descripcion?: string; cuenta?: { nombre?: string } };
      }> = [];

      if (arregloIds.length > 0) {
        let cobrosQuery = supabase
          .from("operaciones_cobro_arreglo")
          .select(`
            operacion_id,
            arreglo_id,
            created_at,
            operacion:operaciones(fecha),
            movimiento:operaciones_movimiento_cuenta(
              importe,
              descripcion,
              cuenta:cuentas_financieras(nombre)
            )
          `)
          .in("arreglo_id", arregloIds);

        const { data: cobrosData } = await cobrosQuery;
        cobrosRows = (cobrosData as unknown as typeof cobrosRows) ?? [];
      }

      const movimientos: ClienteMovimientoCuenta[] = [];

      for (const a of arregloRows) {
        const patente = vehiculoMap.get(a.vehiculo_id) ?? "";
        movimientos.push({
          id: a.id,
          fecha: a.fecha,
          created_at: a.created_at,
          tipo_movimiento: "CARGO_ARREGLO",
          concepto: `${a.descripcion || "Arreglo de vehículo"}${patente ? ` - ${patente}` : ""}`,
          comprobante: null,
          debito: Number(a.precio_final ?? 0),
          credito: 0,
          arreglo_id: a.id,
          operacion_id: null,
          cuenta_nombre: null,
        });
      }

      for (const c of cobrosRows) {
        const arregloRef = arregloRows.find((a) => a.id === c.arreglo_id);
        const patente = arregloRef ? vehiculoMap.get(arregloRef.vehiculo_id) ?? "" : "";
        const mov = c.movimiento;
        const fechaCobro = c.operacion?.fecha ?? c.created_at;

        if (from && fechaCobro < from) continue;
        if (to && fechaCobro > to) continue;

        movimientos.push({
          id: c.operacion_id,
          fecha: fechaCobro,
          created_at: c.created_at,
          tipo_movimiento: "COBRO",
          concepto: `${mov?.descripcion || "Cobro registrado"}${patente ? ` (${patente})` : ""}`,
          comprobante: null,
          debito: 0,
          credito: Number(mov?.importe ?? 0),
          arreglo_id: c.arreglo_id,
          operacion_id: c.operacion_id,
          cuenta_nombre: mov?.cuenta?.nombre ?? null,
        });
      }

      movimientos.sort(
        (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
      );

      let runningBalance = 0;
      const finalMovimientos = movimientos.map((m) => {
        runningBalance += m.debito - m.credito;
        return { ...m, saldo_acumulado: runningBalance };
      });

      return { data: finalMovimientos.reverse(), error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error cargando cuenta corriente";
      return { data: null, error: new Error(msg) };
    }
  },
};
