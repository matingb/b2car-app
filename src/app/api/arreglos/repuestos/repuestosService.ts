import type { SupabaseClient } from "@supabase/supabase-js";

export type OperacionLineaRow = {
  id: string;
  operacion_id: string;
};

export type OperacionAsignacionArregloRow = {
  operacion_id: string;
  arreglo_id: string;
};

export const repuestosService = {
  async getOperacionLineaById(
    supabase: SupabaseClient,
    lineaId: string
  ) {
    return await supabase
      .from("operaciones_lineas")
      .select("id, operacion_id")
      .eq("id", lineaId)
      .maybeSingle();
  },

  async getAsignacionByOperacionAndArreglo(
    supabase: SupabaseClient,
    input: { operacionId: string; arregloId: string }
  ) {
    return await supabase
      .from("operaciones_asignacion_arreglo")
      .select("operacion_id, arreglo_id")
      .eq("operacion_id", input.operacionId)
      .eq("arreglo_id", input.arregloId)
      .maybeSingle();
  },

  async deleteAsignacionArregloLinea(
    supabase: SupabaseClient,
    lineaId: string
  ) {
    return await supabase.rpc("rpc_delete_asignacion_arreglo_linea", {
      p_operacion_linea_id: lineaId,
    });
  },
};

