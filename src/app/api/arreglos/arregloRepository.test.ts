import { describe, it, expect, vi } from "vitest";
import { supabaseArregloRepository } from "./arregloRepository";
import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import { ServiceError } from "@/app/api/serviceError";

function createQueryChain(resolvedValue: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const m of [
    "select", "ilike", "eq", "neq", "gte", "lte", "gt", "lt",
    "or", "in", "not", "order", "limit", "single",
    "insert", "update", "delete", "upsert",
  ]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (
    onFulfilled: (v: unknown) => unknown,
    onRejected?: (e: unknown) => unknown,
  ) => Promise.resolve(resolvedValue).then(onFulfilled, onRejected);
  return chain;
}

function makeSupabase(tableData: Record<string, { data: unknown; error: unknown }>) {
  const chains: Record<string, ReturnType<typeof createQueryChain>> = {};
  const supabase = {
    from: vi.fn().mockImplementation((table: string) =>
      (chains[table] = createQueryChain(tableData[table] ?? { data: [], error: null })),
    ),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    __chains: chains,
  };
  return supabase as unknown as SupabaseClient & {
    __chains: Record<string, ReturnType<typeof createQueryChain>>;
  };
}

const pgError = (code = "XXXXX"): PostgrestError => ({
  name: "PostgrestError",
  code,
  message: "db error",
  details: "",
  hint: "",
});

describe("supabaseArregloRepository", () => {
  describe("getArreglo — filtro por patente", () => {
    it("si la búsqueda de patente no encuentra vehículos, retorna lista vacía ignorando los datos de arreglos", async () => {
      const supabase = makeSupabase({
        vehiculos: { data: [], error: null },
        arreglos: { data: [{ id: "a1", descripcion: "No debería verse" }], error: null },
      });

      const result = await supabaseArregloRepository.getArreglo(supabase, {
        limit: 10,
        patente: "XYZ999",
      });

      expect(result).toEqual({ data: { rows: [], hasMore: false }, error: null });
    });

    it("si la query de patente falla, retorna el error propagado", async () => {
      const supabase = makeSupabase({ vehiculos: { data: null, error: pgError() } });

      const result = await supabaseArregloRepository.getArreglo(supabase, {
        limit: 10,
        patente: "XYZ999",
      });

      expect(result.data).toBeNull();
      expect(result.error).toBe(ServiceError.Unknown);
    });
  });

  describe("getArreglo - busqueda por dueno", () => {
    it("incluye vehiculos encontrados por nombre_cliente en la busqueda global", async () => {
      const supabase = makeSupabase({
        vista_vehiculos_con_clientes: { data: [{ id: "v1" }], error: null },
        arreglos: { data: [{ id: "a1", vehiculo_id: "v1" }], error: null },
      });

      const result = await supabaseArregloRepository.getArreglo(supabase, {
        limit: 10,
        search: "Juan",
      });

      expect(result.error).toBeNull();
      expect(supabase.from).toHaveBeenCalledWith("vista_vehiculos_con_clientes");
      expect(supabase.__chains.vista_vehiculos_con_clientes.or).toHaveBeenCalledWith(
        "nombre_cliente.ilike.%Juan%,patente.ilike.%Juan%"
      );
      expect(supabase.__chains.arreglos.or).toHaveBeenCalledWith(
        "descripcion.ilike.%Juan%,tipo.ilike.%Juan%,observaciones.ilike.%Juan%,vehiculo_id.in.(v1)"
      );
    });

    it("si la busqueda de vehiculos falla, retorna el error propagado", async () => {
      const supabase = makeSupabase({
        vista_vehiculos_con_clientes: { data: null, error: pgError() },
      });

      const result = await supabaseArregloRepository.getArreglo(supabase, {
        limit: 10,
        search: "Juan",
      });

      expect(result.data).toBeNull();
      expect(result.error).toBe(ServiceError.Unknown);
    });
  });

  describe("listOperacionIdsByArregloId", () => {
    it("error de BD → retorna { data: null, error: ServiceError }", async () => {
      const supabase = makeSupabase({
        operaciones_asignacion_arreglo: { data: null, error: pgError() },
      });

      const result = await supabaseArregloRepository.listOperacionIdsByArregloId(supabase, "a1");

      expect(result.data).toBeNull();
      expect(result.error).toBe(ServiceError.Unknown);
    });

    it("mapea operacion_id a strings y filtra valores nulos o vacíos", async () => {
      const supabase = makeSupabase({
        operaciones_asignacion_arreglo: {
          data: [
            { operacion_id: "op1" },
            { operacion_id: "" },
            { operacion_id: null },
            { operacion_id: "op2" },
          ],
          error: null,
        },
      });

      const result = await supabaseArregloRepository.listOperacionIdsByArregloId(supabase, "a1");

      expect(result.error).toBeNull();
      expect(result.data).toEqual(["op1", "op2"]);
    });
  });
});
