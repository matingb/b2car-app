import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cliente } from "@/model/types";
import { TipoCliente } from "@/model/types";
import {
  normalizePaginationLimit,
  getLimitSentinel,
  sliceWithHasMore,
} from "@/lib/pagination";

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
    dni_cuil?: string | null;
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

export type ClienteListFilters = {
  limit?: number;
  search?: string;
  tipo?: "particular" | "empresa";
  saldo?: "PENDIENTE" | "AL_DIA" | "A_FAVOR";
};

export type ClienteListPageResult = {
  rows: Cliente[];
  hasMore: boolean;
};

async function listClienteIdsBySearch(
  supabase: SupabaseClient,
  search: string
): Promise<string[]> {
  const safeSearch = search.trim();
  if (!safeSearch) return [];

  const [particularesRes, empresasRes] = await Promise.all([
    supabase
      .from("particulares")
      .select("id")
      .or(
        `nombre.ilike.%${safeSearch}%,apellido.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,telefono.ilike.%${safeSearch}%,direccion.ilike.%${safeSearch}%,dni_cuil.ilike.%${safeSearch}%`
      ),
    supabase
      .from("empresas")
      .select("id")
      .or(
        `nombre.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,telefono.ilike.%${safeSearch}%,direccion.ilike.%${safeSearch}%,cuit.ilike.%${safeSearch}%`
      ),
  ]);

  const ids = new Set<string>();
  for (const row of (particularesRes.data ?? []) as Array<{ id: string }>) {
    if (row?.id) ids.add(String(row.id));
  }
  for (const row of (empresasRes.data ?? []) as Array<{ id: string }>) {
    if (row?.id) ids.add(String(row.id));
  }

  return Array.from(ids);
}

async function listClienteIdsBySaldo(
  supabase: SupabaseClient,
  saldoFilter: "PENDIENTE" | "AL_DIA" | "A_FAVOR"
): Promise<string[]> {
  const [vehiculosRes, arreglosRes, allClientesRes] = await Promise.all([
    supabase.from("vehiculos").select("id, cliente_id"),
    supabase
      .from("arreglos")
      .select("id, precio_final, total_cobrado, esta_pago, cliente_id, vehiculo_id, estado")
      .neq("estado", "PRESUPUESTO"),
    supabase.from("clientes").select("id"),
  ]);

  const vehiculoToCliente = new Map<string, string>();
  for (const v of (vehiculosRes.data ?? []) as Array<{ id: string; cliente_id: string | null }>) {
    if (v.cliente_id) {
      vehiculoToCliente.set(v.id, v.cliente_id);
    }
  }

  const saldoMap = new Map<string, number>();
  for (const c of (allClientesRes.data ?? []) as Array<{ id: string }>) {
    saldoMap.set(c.id, 0);
  }

  for (const a of (arreglosRes.data ?? []) as Array<{
    id: string;
    precio_final?: number | null;
    total_cobrado?: number | null;
    cliente_id?: string | null;
    vehiculo_id?: string | null;
    estado?: string;
  }>) {
    const targetClienteId =
      a.cliente_id || (a.vehiculo_id ? vehiculoToCliente.get(a.vehiculo_id) : null);
    if (targetClienteId) {
      const precio = Number(a.precio_final ?? 0);
      const cobrado = Number(a.total_cobrado ?? 0);
      const saldoNeto = precio - cobrado;
      saldoMap.set(targetClienteId, (saldoMap.get(targetClienteId) ?? 0) + saldoNeto);
    }
  }

  const matchingIds: string[] = [];
  for (const [clienteId, saldo] of saldoMap.entries()) {
    if (saldoFilter === "PENDIENTE" && saldo > 0) {
      matchingIds.push(clienteId);
    } else if (saldoFilter === "AL_DIA" && saldo === 0) {
      matchingIds.push(clienteId);
    } else if (saldoFilter === "A_FAVOR" && saldo < 0) {
      matchingIds.push(clienteId);
    }
  }

  return matchingIds;
}

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

  async getClientes(
    supabase: SupabaseClient,
    filters?: ClienteListFilters
  ): Promise<{ data: ClienteListPageResult | null; error: Error | null }> {
    const limit = normalizePaginationLimit(filters?.limit);
    const safeSearch = String(filters?.search ?? "").trim();
    const safeTipo = filters?.tipo;
    const safeSaldo = filters?.saldo;

    let targetIds: string[] | null = null;

    if (safeSearch) {
      const searchIds = await listClienteIdsBySearch(supabase, safeSearch);
      if (searchIds.length === 0) {
        return { data: { rows: [], hasMore: false }, error: null };
      }
      targetIds = searchIds;
    }

    if (safeSaldo) {
      const saldoIds = await listClienteIdsBySaldo(supabase, safeSaldo);
      if (saldoIds.length === 0) {
        return { data: { rows: [], hasMore: false }, error: null };
      }
      if (targetIds !== null) {
        const saldoSet = new Set(saldoIds);
        targetIds = targetIds.filter((id) => saldoSet.has(id));
        if (targetIds.length === 0) {
          return { data: { rows: [], hasMore: false }, error: null };
        }
      } else {
        targetIds = saldoIds;
      }
    }

    let query = supabase
      .from("clientes")
      .select("*, particular:particulares(*), empresa:empresas(*)")
      .order("fecha_creacion", { ascending: false })
      .order("id", { ascending: false })
      .limit(getLimitSentinel(limit));

    if (safeTipo) {
      query = query.eq("tipo_cliente", safeTipo);
    }

    if (targetIds !== null) {
      query = query.in("id", targetIds);
    }

    const { data: rawRows, error: clientesError } = await query;
    if (clientesError) {
      return { data: null, error: new Error(clientesError.message) };
    }

    const rows = (rawRows ?? []) as ClienteListRow[];
    const { items, hasMore } = sliceWithHasMore(rows, limit);

    const clientIds = items.map((c) => c.id);
    const vehiculoToCliente = new Map<string, string>();
    const vehiculosCountMap = new Map<string, number>();
    const saldoCuentaMap = new Map<string, number>();

    if (clientIds.length > 0) {
      const { data: vehiculosData } = await supabase
        .from("vehiculos")
        .select("id, cliente_id")
        .in("cliente_id", clientIds);

      const vehiculoIds: string[] = [];
      for (const v of (vehiculosData ?? []) as Array<{ id: string; cliente_id: string | null }>) {
        if (v.cliente_id) {
          vehiculoToCliente.set(v.id, v.cliente_id);
          vehiculosCountMap.set(v.cliente_id, (vehiculosCountMap.get(v.cliente_id) ?? 0) + 1);
          vehiculoIds.push(v.id);
        }
      }

      let arreglosQuery = supabase
        .from("arreglos")
        .select("id, precio_final, total_cobrado, esta_pago, cliente_id, vehiculo_id, estado")
        .neq("estado", "PRESUPUESTO");

      if (vehiculoIds.length > 0) {
        arreglosQuery = arreglosQuery.or(
          `cliente_id.in.(${clientIds.join(",")}),vehiculo_id.in.(${vehiculoIds.join(",")})`
        );
      } else {
        arreglosQuery = arreglosQuery.in("cliente_id", clientIds);
      }

      const { data: arreglosData } = await arreglosQuery;

      for (const a of (arreglosData ?? []) as Array<{
        id: string;
        precio_final?: number | null;
        total_cobrado?: number | null;
        cliente_id?: string | null;
        vehiculo_id?: string | null;
        estado?: string;
      }>) {
        const targetClienteId =
          a.cliente_id || (a.vehiculo_id ? vehiculoToCliente.get(a.vehiculo_id) : null);
        if (targetClienteId && clientIds.includes(targetClienteId)) {
          const precio = Number(a.precio_final ?? 0);
          const cobrado = Number(a.total_cobrado ?? 0);
          const saldoNetoArreglo = precio - cobrado;
          saldoCuentaMap.set(
            targetClienteId,
            (saldoCuentaMap.get(targetClienteId) ?? 0) + saldoNetoArreglo
          );
        }
      }
    }

    const clientes: Cliente[] = items.map((cliente) => {
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
          dni_cuil: cliente.particular?.dni_cuil ?? null,
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

    return {
      data: {
        rows: clientes,
        hasMore,
      },
      error: null,
    };
  },
};


