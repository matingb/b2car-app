import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clienteService } from "./clienteService";
import { TipoCliente } from "@/model/types";

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

type QueryResult = { data: unknown[] | null; error: { message: string } | null };
type BuilderState = { table: string; inIds: string[] | null };

function createSupabaseFake(
  resolveTable: (state: BuilderState) => QueryResult
): { supabase: SupabaseClient; clientesInCalls: Array<string[] | null> } {
  const clientesInCalls: Array<string[] | null> = [];

  const from = (table: string) => {
    const state: BuilderState = { table, inIds: null };

    const builder = {
      select: () => builder,
      or: () => builder,
      eq: () => builder,
      neq: () => builder,
      order: () => builder,
      limit: () => builder,
      in: (_column: string, ids: string[]) => {
        state.inIds = ids;
        return builder;
      },
      then: (
        onFulfilled: (value: QueryResult) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => {
        if (state.table === "clientes") {
          clientesInCalls.push(state.inIds);
        }
        return Promise.resolve(resolveTable(state)).then(onFulfilled, onRejected);
      },
    };

    return builder;
  };

  return { supabase: { from } as unknown as SupabaseClient, clientesInCalls };
}

function buildParticularIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `cliente-${String(i).padStart(4, "0")}`);
}

function buildClienteRow(id: string, fechaCreacion: string) {
  return {
    id,
    tipo_cliente: TipoCliente.PARTICULAR,
    fecha_creacion: fechaCreacion,
    particular: { nombre: id, apellido: "" },
    empresa: null,
  };
}

describe("clienteService.getClientes", () => {
  it("parte el filtro de ids en varias queries cuando la búsqueda matchea muchos clientes", async () => {
    const ids = buildParticularIds(250);

    const { supabase, clientesInCalls } = createSupabaseFake((state) => {
      if (state.table === "particulares") {
        return { data: ids.map((id) => ({ id })), error: null };
      }
      if (state.table === "empresas") {
        return { data: [], error: null };
      }
      if (state.table === "clientes") {
        const chunk = state.inIds ?? [];
        return {
          data: chunk.map((id, index) =>
            buildClienteRow(id, new Date(2026, 0, 1, 0, index).toISOString())
          ),
          error: null,
        };
      }
      return { data: [], error: null };
    });

    const { data, error } = await clienteService.getClientes(supabase, {
      search: "a",
      limit: 50,
    });

    expect(error).toBeNull();
    expect(clientesInCalls).toHaveLength(3);
    for (const call of clientesInCalls) {
      expect(call?.length).toBeLessThanOrEqual(100);
    }
    expect(clientesInCalls.flatMap((call) => call ?? [])).toEqual(ids);

    expect(data?.rows).toHaveLength(50);
    expect(data?.hasMore).toBe(true);

    const fechas = data?.rows.map((row) => row.id) ?? [];
    expect(fechas[0]).toBe("cliente-0199");
  });

  it("usa una sola query cuando no hay filtros que generen lista de ids", async () => {
    const { supabase, clientesInCalls } = createSupabaseFake((state) => {
      if (state.table === "clientes") {
        return { data: [buildClienteRow("cliente-1", "2026-01-01T00:00:00.000Z")], error: null };
      }
      return { data: [], error: null };
    });

    const { data, error } = await clienteService.getClientes(supabase, { limit: 50 });

    expect(error).toBeNull();
    expect(clientesInCalls).toEqual([null]);
    expect(data?.rows).toHaveLength(1);
    expect(data?.hasMore).toBe(false);
  });

  it("propaga el error si alguna de las queries por chunk falla", async () => {
    const ids = buildParticularIds(150);

    const { supabase } = createSupabaseFake((state) => {
      if (state.table === "particulares") {
        return { data: ids.map((id) => ({ id })), error: null };
      }
      if (state.table === "clientes") {
        return { data: null, error: { message: "Bad Request" } };
      }
      return { data: [], error: null };
    });

    const { data, error } = await clienteService.getClientes(supabase, {
      search: "a",
      limit: 50,
    });

    expect(data).toBeNull();
    expect(error?.message).toBe("Bad Request");
  });
});
