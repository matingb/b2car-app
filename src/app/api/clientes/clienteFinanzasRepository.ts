import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { type ServiceError, toServiceError } from "@/app/api/serviceError";
import type { SentidoMovimientoCuentaCorriente } from "@/model/types";

export interface CuentaCorrienteFilters {
  from?: string | null;
  to?: string | null;
}

export type CreateMovimientoDirectoClientePayload = {
  cliente_id: string;
  sentido?: SentidoMovimientoCuentaCorriente;
  cuenta_id?: string | null;
  monto?: number | null;
  fecha?: string;
  descripcion?: string | null;
  idempotency_key?: string | null;
  observaciones?: string | null;
  taller_id?: string | null;
  pagos?: Array<{
    cuenta_id: string;
    monto: number;
    fecha?: string;
    descripcion?: string;
    idempotency_key?: string;
  }>;
};

export type MovimientoCuentaCorrienteRow = {
  id: unknown;
  fecha: unknown;
  created_at?: unknown;
  tipo_movimiento: unknown;
  concepto?: unknown;
  comprobante?: unknown;
  debito?: unknown;
  credito?: unknown;
  arreglo_id?: unknown;
  operacion_id?: unknown;
  cuenta_nombre?: unknown;
};

export type ClienteSaldoRow = {
  cliente_id: string;
  saldo: number;
};

export interface ClienteFinanzasRepository {
  getResumenFinanciero(
    db: SupabaseClient,
    clienteId: string
  ): Promise<{ data: unknown; error: PostgrestError | Error | null }>;

  getCuentaCorriente(
    db: SupabaseClient,
    clienteId: string,
    filters?: CuentaCorrienteFilters
  ): Promise<{ data: MovimientoCuentaCorrienteRow[] | null; error: PostgrestError | Error | null }>;

  getSaldos(
    db: SupabaseClient,
    clienteIds?: string[] | null
  ): Promise<{ data: ClienteSaldoRow[] | null; error: PostgrestError | Error | null }>;

  createMovimientoDirecto?(
    db: SupabaseClient,
    payload: CreateMovimientoDirectoClientePayload
  ): Promise<{ data: string | null; error: ServiceError | PostgrestError | null }>;
}

export const clienteFinanzasRepository: ClienteFinanzasRepository = {
  async getResumenFinanciero(db, clienteId) {
    const { data, error } = await db.rpc("rpc_cliente_resumen_financiero", {
      p_cliente_id: clienteId,
    });
    return { data, error };
  },

  async getCuentaCorriente(db, clienteId, filters) {
    const { data, error } = await db.rpc("rpc_cliente_cuenta_corriente", {
      p_cliente_id: clienteId,
      p_from: filters?.from ?? null,
      p_to: filters?.to ?? null,
    });
    return { data: (data as MovimientoCuentaCorrienteRow[] | null) ?? null, error };
  },

  async getSaldos(db, clienteIds) {
    const { data, error } = await db.rpc("rpc_clientes_saldos", {
      p_cliente_ids: clienteIds && clienteIds.length > 0 ? clienteIds : null,
    });
    return { data: (data as ClienteSaldoRow[] | null) ?? null, error };
  },

  async createMovimientoDirecto(db, payload) {
    const rpcName =
      payload.sentido === "PAGO"
        ? "rpc_crear_pago_cliente"
        : "rpc_crear_cobro_cliente";

    const { data, error } = await db.rpc(rpcName, {
      p_cliente_id: payload.cliente_id,
      p_cuenta_id: payload.cuenta_id ?? null,
      p_monto: payload.monto ?? null,
      p_fecha: payload.fecha ?? new Date().toISOString(),
      p_descripcion: payload.descripcion ?? null,
      p_idempotency_key: payload.idempotency_key ?? null,
      p_observaciones: payload.observaciones ?? null,
      p_taller_id: payload.taller_id ?? null,
      p_pagos: payload.pagos && payload.pagos.length > 0 ? payload.pagos : null,
    });

    if (error) return { data: null, error: toServiceError(error) ?? error };
    return { data: typeof data === "string" ? data : String(data ?? ""), error: null };
  },
};

export const supabaseClienteFinanzasRepository = clienteFinanzasRepository;
