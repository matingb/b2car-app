import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cliente } from "@/model/types";
import { TipoCliente } from "@/model/types";

export type ClienteListRow = {
  id: string;
  tipo_cliente: TipoCliente;
  particular?: {
    nombre?: string;
    apellido?: string;
    codigo_pais?: string;
    telefono?: string;
    email?: string;
    direccion?: string;
  } | null;
  empresa?: {
    nombre?: string;
    codigo_pais?: string;
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
    const [clientesRes, vehiculosRes, arreglosRes] = await Promise.all([
      supabase
        .from("clientes")
        .select("*, particular:particulares(*), empresa:empresas(*)"),
      supabase
        .from("vehiculos")
        .select("id, cliente_id"),
      supabase
        .from("arreglos")
        .select("id, precio_final, total_cobrado, esta_pago, cliente_id, vehiculo_id, estado")
        .neq("estado", "PRESUPUESTO"),
    ]);

    if (clientesRes.error) return { data: [], error: new Error(clientesRes.error.message) };

    const vehiculoToCliente = new Map<string, string>();
    const vehiculosCountMap = new Map<string, number>();

    for (const v of (vehiculosRes.data ?? []) as Array<{ id: string; cliente_id: string | null }>) {
      if (v.cliente_id) {
        vehiculoToCliente.set(v.id, v.cliente_id);
        vehiculosCountMap.set(v.cliente_id, (vehiculosCountMap.get(v.cliente_id) ?? 0) + 1);
      }
    }

    const saldoCuentaMap = new Map<string, number>();

    for (const a of (arreglosRes.data ?? []) as Array<{
      id: string;
      precio_final?: number | null;
      total_cobrado?: number | null;
      esta_pago?: boolean | null;
      cliente_id?: string | null;
      vehiculo_id?: string | null;
      estado?: string;
    }>) {
      if (a.estado === "PRESUPUESTO") continue;
      const targetClienteId =
        a.cliente_id || (a.vehiculo_id ? vehiculoToCliente.get(a.vehiculo_id) : null);
      if (targetClienteId) {
        const precio = Number(a.precio_final ?? 0);
        const cobrado = Number(a.total_cobrado ?? 0);
        const saldoNetoArreglo = precio - cobrado;
        saldoCuentaMap.set(
          targetClienteId,
          (saldoCuentaMap.get(targetClienteId) ?? 0) + saldoNetoArreglo
        );
      }
    }

    const rows = (clientesRes.data ?? []) as ClienteListRow[];
    const clientes: Cliente[] = rows.map((cliente) => {
      const saldo_cuenta = saldoCuentaMap.get(cliente.id) ?? 0;
      const vehiculos_count = vehiculosCountMap.get(cliente.id) ?? 0;

      if (cliente.tipo_cliente === TipoCliente.PARTICULAR) {
        const nombre = `${cliente.particular?.nombre || ""} ${cliente.particular?.apellido || ""}`.trim();
        return {
          id: cliente.id,
          nombre,
          tipo_cliente: cliente.tipo_cliente,
          codigo_pais: cliente.particular?.codigo_pais ?? "",
          telefono: cliente.particular?.telefono ?? "",
          email: cliente.particular?.email ?? "",
          direccion: cliente.particular?.direccion ?? "",
          saldo_cuenta,
          vehiculos_count,
        };
      }

      return {
        id: cliente.id,
        nombre: cliente.empresa?.nombre ?? "",
        tipo_cliente: cliente.tipo_cliente,
        codigo_pais: cliente.empresa?.codigo_pais ?? "",
        telefono: cliente.empresa?.telefono ?? "",
        email: cliente.empresa?.email ?? "",
        direccion: cliente.empresa?.direccion ?? "",
        cuit: cliente.empresa?.cuit,
        saldo_cuenta,
        vehiculos_count,
      };
    });

    return { data: clientes, error: null };
  },
};


