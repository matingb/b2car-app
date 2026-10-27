import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

export interface CuentaCorrienteFilters {
  from?: string | null;
  to?: string | null;
}

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
};

export const supabaseClienteFinanzasRepository = clienteFinanzasRepository;
