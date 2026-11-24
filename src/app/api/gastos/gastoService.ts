import type { SupabaseClient } from "@supabase/supabase-js";
import { ServiceError, serviceFailure, type ServiceResult } from "@/app/api/serviceError";
import { logger } from "@/lib/logger";
import type { ActualizarGastoFinancieroInput, GastoFinanciero } from "@/model/finanzas";
import { gastoRepository, type GastoRow } from "./gastoRepository";

function mapGasto(row: GastoRow): GastoFinanciero {
  const importe = Number(row.monto_total);
  const cuentaIds = new Set(row.pagos.map((pago) => pago.cuenta_id));
  const pago = cuentaIds.size === 1 ? row.pagos[0] : undefined;

  return {
    id: row.id,
    cuentaId: pago?.cuenta_id ?? "",
    cuentaNombre: pago?.cuenta?.nombre ?? null,
    cantidadPagos: row.pagos.length,
    puedeCambiarImporte: row.pagos.length === 0 || (
      row.pagos.length === 1 && Math.abs(Number(row.pagos[0].importe)) === importe
    ),
    categoria: row.gasto.categoria_gasto,
    importe,
    fecha: row.fecha,
    descripcion: row.gasto.descripcion || null,
    observaciones: row.observaciones || null,
    tallerId: row.taller_id,
    reversaMovimientoId: null,
    createdAt: row.created_at,
  };
}

export function createGastoService(repository = gastoRepository) {
  async function getById(supabase: SupabaseClient, id: string): Promise<ServiceResult<GastoFinanciero>> {
    const { data, error } = await repository.getById(supabase, id);
    if (error) return { data: null, ...serviceFailure(error) };
    if (!data) return { data: null, error: ServiceError.NotFound };
    return { data: mapGasto(data), error: null };
  }

  return {
    getById,
    async update(supabase: SupabaseClient, id: string, input: ActualizarGastoFinancieroInput): Promise<ServiceResult<GastoFinanciero>> {
      const result = await getById(supabase, id);
      if (!result.data) return result;
      const current = result.data;
      const cuentaId = input.cuentaId !== current.cuentaId ? input.cuentaId : undefined;
      if (cuentaId && current.cantidadPagos === 0) {
        return { data: null, error: ServiceError.Validation };
      }

      const { error } = await repository.update(supabase, {
        p_operacion_id: id,
        p_cuenta_id: cuentaId ?? null,
        p_categoria_gasto: input.categoria ?? null,
        p_importe: input.importe !== current.importe ? input.importe ?? null : null,
        p_descripcion: input.descripcion === undefined ? null : input.descripcion ?? "",
        p_fecha: input.fecha ?? null,
        p_idempotency_key: input.idempotencyKey ?? null,
        p_observaciones: input.observaciones === undefined ? null : input.observaciones ?? "",
        p_taller_id: input.tallerId ?? null,
      });
      if (error) return { data: null, ...serviceFailure(error) };

      const refreshed = await getById(supabase, id);
      if (refreshed.data) return refreshed;

      logger.error("[gastos.update] Error consultando el gasto actualizado", {
        gastoId: id,
        code: refreshed.cause?.code ?? refreshed.error,
      });
      return {
        data: {
          ...current,
          cuentaId: cuentaId ?? current.cuentaId,
          cuentaNombre: cuentaId ? null : current.cuentaNombre,
          categoria: input.categoria ?? current.categoria,
          importe: input.importe ?? current.importe,
          descripcion: input.descripcion === undefined ? current.descripcion : input.descripcion || null,
          observaciones: input.observaciones === undefined ? current.observaciones : input.observaciones || null,
          tallerId: input.tallerId ?? current.tallerId,
          fecha: input.fecha ?? current.fecha,
        },
        error: null,
      };
    },
    async deleteById(supabase: SupabaseClient, id: string) {
      const { data, error } = await repository.deleteById(supabase, id);
      if (error) return serviceFailure(error);
      return { error: data === false ? ServiceError.NotFound : null };
    },
  };
}

export const gastoService = createGastoService();
