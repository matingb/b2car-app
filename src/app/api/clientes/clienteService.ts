import type { SupabaseClient } from "@supabase/supabase-js";

export const clienteService = {
  async countAll(supabase: SupabaseClient): Promise<number> {
    const { data, error } = await supabase.rpc("dashboard_count_clientes");
    if (error) throw new Error(error.message);
    return (data ?? 0) as number;
  },

  async nuevosPorDia(
    supabase: SupabaseClient,
    fromISO: string,
    toISO: string
  ): Promise<{ dias: string[]; valor: number[] }> {
    const { data, error } = await supabase.rpc("dashboard_clientes_nuevos_por_dia", {
      p_from: fromISO,
      p_to: toISO,
    });
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<{ label?: unknown; valor?: unknown }>;
    const dias: string[] = [];
    const valor: number[] = [];
    for (const r of rows) {
      dias.push(String(r.label ?? ""));
      valor.push(Number(r.valor ?? 0) || 0);
    }

    return { dias, valor };
  },
};


