import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cliente } from "@/model/types";
import { TipoCliente } from "@/model/types";

type ClienteListRow = {
  id: string;
  tipo_cliente: TipoCliente;
  particular?: {
    nombre?: string;
    apellido?: string;
    telefono?: string;
    email?: string;
    direccion?: string;
  } | null;
  empresa?: {
    nombre?: string;
    telefono?: string;
    email?: string;
    direccion?: string;
    cuit?: string;
  } | null;
};

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

  async listAll(
    supabase: SupabaseClient
  ): Promise<{ data: Cliente[]; error: Error | null }> {
    const { data, error } = await supabase
      .from("clientes")
      .select("*, particular:particulares(*), empresa:empresas(*)");

    if (error) return { data: [], error: new Error(error.message) };

    const rows = (data ?? []) as ClienteListRow[];
    const clientes: Cliente[] = rows.map((cliente) => {
      if (cliente.tipo_cliente === TipoCliente.PARTICULAR) {
        const nombre = `${cliente.particular?.nombre || ""} ${cliente.particular?.apellido || ""}`.trim();
        return {
          id: cliente.id,
          nombre,
          tipo_cliente: cliente.tipo_cliente,
          telefono: cliente.particular?.telefono ?? "",
          email: cliente.particular?.email ?? "",
          direccion: cliente.particular?.direccion ?? "",
        };
      }

      return {
        id: cliente.id,
        nombre: cliente.empresa?.nombre ?? "",
        tipo_cliente: cliente.tipo_cliente,
        telefono: cliente.empresa?.telefono ?? "",
        email: cliente.empresa?.email ?? "",
        direccion: cliente.empresa?.direccion ?? "",
        cuit: cliente.empresa?.cuit,
      };
    });

    return { data: clientes, error: null };
  },
};


