import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  ClienteResumenFinanciero,
  ClienteMovimientoCuenta,
} from "@/model/types";
import { ServiceError } from "@/app/api/serviceError";
import { isValidUuid } from "@/lib/uuid";
import { logger } from "@/lib/logger";
import {
  type ClienteFinanzasRepository,
  type CuentaCorrienteFilters,
  clienteFinanzasRepository,
} from "./clienteFinanzasRepository";

export type { CuentaCorrienteFilters };

export type CreateMovimientoDirectoClienteInput = {
  cuentaId?: string;
  importe?: number;
  fecha?: string;
  descripcion?: string | null;
  idempotencyKey?: string | null;
  observaciones?: string | null;
  tallerId?: string | null;
  pagos?: Array<{
    cuentaId: string;
    importe: number;
    fecha?: string;
    descripcion?: string;
    idempotencyKey?: string;
  }>;
};

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
        (a, b) =>
          Date.parse(a.fecha as string) - Date.parse(b.fecha as string) ||
          Date.parse((a.created_at ?? a.fecha) as string) - Date.parse((b.created_at ?? b.fecha) as string) ||
          (Number(b.debito) > 0 ? 1 : 0) - (Number(a.debito) > 0 ? 1 : 0)
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

    async createMovimientoDirecto(
      db: SupabaseClient,
      clienteId: string,
      input: CreateMovimientoDirectoClienteInput
    ): Promise<{ data: string | null; error: ServiceError | PostgrestError | null }> {
      if (!clienteId || !isValidUuid(clienteId)) {
        return { data: null, error: ServiceError.Validation };
      }
      if (typeof repository.createMovimientoDirecto !== "function") {
        return { data: null, error: ServiceError.Unknown };
      }

      const hasPagosArray = Array.isArray(input.pagos) && input.pagos.length > 0;

      if (hasPagosArray) {
        let totalImporte = 0;
        for (const p of input.pagos!) {
          if (!p.cuentaId || !isValidUuid(p.cuentaId)) {
            return { data: null, error: ServiceError.Validation };
          }
          if (!p.importe) {
            return { data: null, error: ServiceError.Validation };
          }
          totalImporte += p.importe;
        }

        return repository.createMovimientoDirecto(db, {
          cliente_id: clienteId,
          cuenta_id: input.pagos![0].cuentaId,
          importe: totalImporte,
          fecha: input.fecha,
          descripcion: input.descripcion ? input.descripcion.trim() : null,
          idempotency_key: input.idempotencyKey ?? null,
          observaciones: input.observaciones ? input.observaciones.trim() : null,
          taller_id: input.tallerId ?? null,
          pagos: input.pagos!.map((p) => ({
            cuenta_id: p.cuentaId,
            importe: p.importe,
            fecha: p.fecha,
            descripcion: p.descripcion ? p.descripcion.trim() : undefined,
            idempotency_key: p.idempotencyKey,
          })),
        });
      }

      if (!input.cuentaId || !isValidUuid(input.cuentaId)) {
        return { data: null, error: ServiceError.Validation };
      }
      if (!input.importe) {
        return { data: null, error: ServiceError.Validation };
      }

      return repository.createMovimientoDirecto(db, {
        cliente_id: clienteId,
        cuenta_id: input.cuentaId,
        importe: input.importe,
        fecha: input.fecha,
        descripcion: input.descripcion ? input.descripcion.trim() : null,
        idempotency_key: input.idempotencyKey ?? null,
        observaciones: input.observaciones ? input.observaciones.trim() : null,
        taller_id: input.tallerId ?? null,
      });
    },
  };
}

export const clienteFinanzasService = createClienteFinanzasService(
  clienteFinanzasRepository
);
