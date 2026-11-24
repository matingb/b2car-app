import type { SupabaseClient } from "@supabase/supabase-js";

export type GastoRow = {
  id: string;
  fecha: string;
  created_at: string;
  taller_id: string | null;
  observaciones: string | null;
  monto_total: number;
  gasto: { categoria_gasto: string; descripcion: string | null };
  pagos: Array<{
    cuenta_id: string;
    importe: number;
    cuenta: { nombre: string } | null;
  }>;
};

export type ActualizarGastoParams = {
  p_operacion_id: string;
  p_cuenta_id: string | null;
  p_categoria_gasto: string | null;
  p_importe: number | null;
  p_descripcion: string | null;
  p_fecha: string | null;
  p_idempotency_key: string | null;
  p_observaciones: string | null;
  p_taller_id: string | null;
};

export const gastoRepository = {
  async getById(supabase: SupabaseClient, id: string) {
    return supabase
      .from("operaciones")
      .select(`
        id, fecha, created_at, taller_id, observaciones, monto_total,
        gasto:operaciones_gasto!inner(categoria_gasto, descripcion),
        pagos:operaciones_movimiento_cuenta!operaciones_movimiento_cuenta_operacion_id_fkey(
          cuenta_id, importe, cuenta:cuentas_financieras(nombre)
        )
      `)
      .eq("id", id)
      .eq("tipo", "GASTO")
      .maybeSingle<GastoRow>();
  },

  update(supabase: SupabaseClient, params: ActualizarGastoParams) {
    return supabase.rpc("rpc_actualizar_movimiento_cuenta", params);
  },

  deleteById(supabase: SupabaseClient, id: string) {
    return supabase.rpc("rpc_eliminar_movimiento_cuenta", { p_operacion_id: id });
  },
};
