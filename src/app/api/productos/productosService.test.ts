import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { productosService } from "./productosService";

describe("productosService.deleteById", () => {
  it("elimina stocks por producto_id antes de borrar el producto", async () => {
    const calls: { table: string; column: string; value: string }[] = [];
    const supabase = {
      from: (table: string) => ({
        delete: () => ({
          eq: async (column: string, value: string) => {
            calls.push({ table, column, value });
            return { error: null };
          },
        }),
      }),
    } as unknown as SupabaseClient;

    const result = await productosService.deleteById(supabase, "PROD-1");

    expect(result.error).toBeNull();
    expect(calls).toEqual([
      { table: "stocks", column: "producto_id", value: "PROD-1" },
      { table: "productos", column: "id", value: "PROD-1" },
    ]);
  });
});
