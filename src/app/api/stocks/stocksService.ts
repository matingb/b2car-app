import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { ProductoRow } from "../productos/productosService";

export enum StocksServiceError {
  NotFound = "NotFound",
  Unknown = "Unknown",
}

function toServiceError(err: PostgrestError): StocksServiceError {
  const code = (err as { code?: string }).code;
  if (code === "PGRST116") return StocksServiceError.NotFound;
  return StocksServiceError.Unknown;
}

export type StockRow = {
  id: string;
  tenant_id: string;
  taller_id: string;
  producto_id: string;
  cantidad: number;
  stock_minimo: number;
  stock_maximo: number;
  created_at: string;
  updated_at: string;
};

export type StockItemRow = StockRow & {
  productos: ProductoRow;
};

export const stocksService = {
  async listAll(
    supabase: SupabaseClient
  ): Promise<{ data: StockItemRow[]; error: StocksServiceError | null }> {
    const { data, error } = await supabase
      .from("stocks")
      .select(
        `*,productos(*)`
      )
      .order("updated_at", { ascending: false });

    if (error) return { data: [], error: toServiceError(error) };
    return { data: (data ?? []) as StockItemRow[], error: null };
  },

  async listForTaller(
    supabase: SupabaseClient,
    tallerId: string 
  ): Promise<{ data: StockItemRow[]; error: StocksServiceError | null }> {
    const query = supabase
      .from("stocks")
      .select(
        `*,productos(*)`
      )
      .eq("tallerId", tallerId)
      .order("updated_at", { ascending: false });

    const { data, error } = await query;
    if (error) return { data: [], error: toServiceError(error) };
    return { data: (data ?? []) as unknown as StockItemRow[], error: null };
  },

  async getById(
    supabase: SupabaseClient,
    id: string
  ): Promise<{ data: StockItemRow | null; error: StocksServiceError | null }> {
    const { data, error } = await supabase
      .from("stocks")
      .select(
        `*,productos(*)`
      )
      .eq("id", id)
      .maybeSingle();

    if (error) return { data: null, error: toServiceError(error) };
    if (!data) return { data: null, error: StocksServiceError.NotFound };
    return { data: data as StockItemRow, error: null };
  },

  async getByTallerProducto(
    supabase: SupabaseClient,
    taller_id: string,
    producto_id: string
  ): Promise<{ data: StockRow | null; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from("stocks")
      .select("*")
      .eq("taller_id", taller_id)
      .eq("producto_id", producto_id)
      .maybeSingle();

    return { data: (data ?? null) as StockRow | null, error };
  },

  async create(
    supabase: SupabaseClient,
    input: Omit<StockRow, "id" | "tenant_id" | "created_at" | "updated_at">
  ): Promise<{ data: StockRow | null; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from("stocks")
      .insert([input])
      .select("*")
      .single();
    return { data: (data ?? null) as StockRow | null, error };
  },

  async upsert(
    supabase: SupabaseClient,
    input: Omit<StockRow, "id" | "tenantId" | "created_at" | "updated_at">
  ): Promise<{ data: StockRow | null; created: boolean; error: PostgrestError | null }> {
    // Try to find existing by unique (tenantId,tallerId,productoId)
    const { data: existing, error: findError } = await supabase
      .from("stocks")
      .select("*")
      .eq("taller_id", input.taller_id)
      .eq("producto_id", input.producto_id)
      .maybeSingle();

    if (findError) return { data: null, created: false, error: findError };

    if (existing) {
      const { data, error } = await supabase
        .from("stocks")
        .update({
          cantidad: input.cantidad,
          stock_minimo: input.stock_minimo,
          stock_maximo: input.stock_maximo,
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      return { data: (data ?? null) as StockRow | null, created: false, error };
    }

    const { data, error } = await supabase
      .from("stocks")
      .insert([input])
      .select("*")
      .single();
    return { data: (data ?? null) as StockRow | null, created: true, error };
  },

  async updateById(
    supabase: SupabaseClient,
    id: string,
    patch: Partial<Pick<StockRow, "cantidad" | "stock_minimo" | "stock_maximo">>
  ): Promise<{ data: StockRow | null; error: StocksServiceError | PostgrestError | null }> {
    const { data, error } = await supabase
      .from("stocks")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) return { data: null, error };
    if (!data) return { data: null, error: StocksServiceError.NotFound };
    return { data: data as StockRow, error: null };
  },

  async deleteById(
    supabase: SupabaseClient,
    id: string
  ): Promise<{ error: StocksServiceError | PostgrestError | null }> {
    const { error } = await supabase.from("stocks").delete().eq("id", id);
    if (error) return { error };
    return { error: null };
  },
};

