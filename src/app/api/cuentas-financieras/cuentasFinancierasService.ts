import type { SupabaseClient } from "@supabase/supabase-js";
import type { CuentaFinanciera } from "@/model/finanzas";
import { asRows, mapCuenta, mapRows } from "./finanzasRouteUtils";

export const cuentasFinancierasService = {
  async getById(
    supabase: SupabaseClient,
    id: string
  ): Promise<{ data: CuentaFinanciera | null; error: Error | null }> {
    const { data, error } = await supabase.rpc("rpc_finanzas_obtener_cuenta", {
      p_cuenta_id: id,
    });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const cuenta = mapCuenta(asRows(data)[0]);
    if (!cuenta) {
      return { data: null, error: new Error("Cuenta financiera no encontrada") };
    }

    return { data: cuenta, error: null };
  },

  async list(
    supabase: SupabaseClient
  ): Promise<{ data: CuentaFinanciera[]; error: Error | null }> {
    const { data, error } = await supabase.rpc("rpc_finanzas_listar_cuentas");
    if (error) {
      return { data: [], error: new Error(error.message) };
    }

    const cuentas = mapRows(data, mapCuenta);
    return { data: cuentas ?? [], error: null };
  },
};
