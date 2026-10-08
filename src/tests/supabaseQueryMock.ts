import type { SupabaseClient } from "@supabase/supabase-js";
import { vi } from "vitest";

export type QueryResult = { data: unknown; error: unknown; count?: number | null };
export type QueryCall = { method: string; args: unknown[] };

/** Builder encadenable de PostgREST que registra llamadas y resuelve con el resultado configurado. */
function builder(result: QueryResult, calls: QueryCall[]) {
  const proxy: unknown = new Proxy({}, {
    get(_target, property) {
      if (property === "then") {
        return (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject);
      }
      if (property === "maybeSingle" || property === "single") return () => Promise.resolve(result);
      return (...args: unknown[]) => {
        calls.push({ method: String(property), args });
        return proxy;
      };
    },
  });
  return proxy;
}

/**
 * Cliente Supabase falso: cada `from(tabla)` consume el siguiente resultado de la cola de esa tabla
 * y registra las llamadas encadenadas en `calls[tabla]`.
 */
export function supabaseQueryMock(tables: Record<string, QueryResult[]>) {
  const calls: Record<string, QueryCall[]> = {};
  const from = vi.fn((table: string) => {
    const queue = tables[table];
    if (!queue?.length) throw new Error(`Consulta inesperada a ${table}`);
    calls[table] ??= [];
    return builder(queue.shift() as QueryResult, calls[table]);
  });
  return { supabase: { from, rpc: vi.fn() } as unknown as SupabaseClient, calls, from };
}

export function selectedColumns(calls: QueryCall[] | undefined): string[] {
  return (calls ?? []).filter((call) => call.method === "select").map((call) => String(call.args[0]));
}
