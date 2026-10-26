import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClienteResumenFinanciero, ClienteMovimientoCuenta } from "@/model/types";
import { logger } from "@/lib/logger";
import {
  type ClienteFinanzasRepository,
  type CuentaCorrienteFilters,
  clienteFinanzasRepository,
} from "./clienteFinanzasRepository";

export type { CuentaCorrienteFilters };

export function createClienteFinanzasService(
  repository: ClienteFinanzasRepository = clienteFinanzasRepository
) {
  return {
    async getResumenFinanciero(
      db: SupabaseClient,
      clienteId: string
    ): Promise<{ data: ClienteResumenFinanciero | null; error: Error | null }> {
      if (!clienteId) {
        return { data: null, error: new Error("ID de cliente requerido") };
      }

      const { data: resumenData, error: resumenError } = await repository.getResumenFinanciero(
        db,
        clienteId
      );

      if (resumenError) {
        logger.error("Error al obtener resumen financiero del cliente", {
          clienteId,
          error: resumenError,
        });
        return {
          data: null,
          error: new Error(resumenError.message || "Error al obtener resumen financiero"),
        };
      }

      if (!resumenData) {
        logger.error("Resumen financiero no encontrado o vacío", { clienteId });
        return {
          data: null,
          error: new Error("Resumen financiero no encontrado"),
        };
      }

      const raw = resumenData as Record<string, unknown>;
      const data: ClienteResumenFinanciero = {
        saldo_cuenta: Number(raw.saldo_cuenta ?? 0),
        saldo_a_facturar: Number(raw.saldo_a_facturar ?? 0),
        total_historico_trabajos: Number(raw.total_historico_trabajos ?? 0),
        total_historico_cobrado: Number(raw.total_historico_cobrado ?? 0),
        cantidad_arreglos_pendientes_pago: Number(raw.cantidad_arreglos_pendientes_pago ?? 0),
        cantidad_arreglos_pendientes_factura: Number(raw.cantidad_arreglos_pendientes_factura ?? 0),
      };

      return { data, error: null };
    },

    async getCuentaCorriente(
      db: SupabaseClient,
      clienteId: string,
      filters: CuentaCorrienteFilters = {}
    ): Promise<{ data: ClienteMovimientoCuenta[] | null; error: Error | null }> {
      if (!clienteId) {
        return { data: null, error: new Error("ID de cliente requerido") };
      }

      const { from = null, to = null } = filters;

      const { data: cuentaRows, error: cuentaError } = await repository.getCuentaCorriente(
        db,
        clienteId,
        { from, to }
      );

      if (cuentaError) {
        logger.error("Error al obtener cuenta corriente del cliente", {
          clienteId,
          filters,
          error: cuentaError,
        });
        return {
          data: null,
          error: new Error(cuentaError.message || "Error al obtener cuenta corriente"),
        };
      }

      if (!cuentaRows || !Array.isArray(cuentaRows)) {
        logger.error("Cuenta corriente retornó formato inválido o vacío", { clienteId });
        return {
          data: null,
          error: new Error("Cuenta corriente no disponible"),
        };
      }

      const sortedAsc = [...cuentaRows].sort(
        (a, b) => new Date(String(a.fecha)).getTime() - new Date(String(b.fecha)).getTime()
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
    },
  };
}

export const clienteFinanzasService = createClienteFinanzasService(
  clienteFinanzasRepository
);
