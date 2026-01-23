import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

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
  tenantId: string;
  tallerId: string;
  productoId: string;
  cantidad: number;
  stock_minimo: number;
  stock_maximo: number;
  created_at: string;
  updated_at: string;
};

export type StockItemRow = StockRow & {
  productos?: any;
};

export type ListStocksFilters = {
  tallerId: string;
  search?: string;
  categorias?: string[];
};

export const stocksService = {
  async listForTaller(
    supabase: SupabaseClient,
    tenantId: string,
    filters: ListStocksFilters
  ): Promise<{ data: StockItemRow[]; error: StocksServiceError | null }> {
    let query = supabase
      .from("stocks")
      .select(
        `id,tenantId,tallerId,productoId,cantidad,stock_minimo,stock_maximo,created_at,updated_at,productos(*)`
      )
      .eq("tenantId", tenantId)
      .eq("tallerId", filters.tallerId)
      .order("updated_at", { ascending: false });

    const search = (filters.search ?? "").trim();
    if (search) {
      const q = search.replace(/%/g, "\\%");
      // Filter on related producto fields
      query = query.or(
        [
          `productos.codigo.ilike.%${q}%`,
          `productos.nombre.ilike.%${q}%`,
          `productos.marca.ilike.%${q}%`,
          `productos.modelo.ilike.%${q}%`,
          `productos.descripcion.ilike.%${q}%`,
          `productos.provedor.ilike.%${q}%`,
        ].join(",")
      );
    }

    const cats = (filters.categorias ?? []).filter(Boolean);
    if (cats.length > 0) {
      // @ts-expect-error: supabase-js supports overlaps at runtime
      query = query.overlaps("productos.categorias", cats);
    }

    const { data, error } = await query;
    if (error) return { data: [], error: toServiceError(error) };
    return { data: (data ?? []) as StockItemRow[], error: null };
  },

  async getById(
    supabase: SupabaseClient,
    tenantId: string,
    id: string
  ): Promise<{ data: StockItemRow | null; error: StocksServiceError | null }> {
    const { data, error } = await supabase
      .from("stocks")
      .select(
        `id,tenantId,tallerId,productoId,cantidad,stock_minimo,stock_maximo,created_at,updated_at,productos(*)`
      )
      .eq("tenantId", tenantId)
      .eq("id", id)
      .maybeSingle();

    if (error) return { data: null, error: toServiceError(error) };
    if (!data) return { data: null, error: StocksServiceError.NotFound };
    return { data: data as StockItemRow, error: null };
  },

  async upsert(
    supabase: SupabaseClient,
    tenantId: string,
    input: Omit<StockRow, "id" | "created_at" | "updated_at">
  ): Promise<{ data: StockRow | null; created: boolean; error: PostgrestError | null }> {
    // Try to find existing by unique (tenantId,tallerId,productoId)
    const { data: existing, error: findError } = await supabase
      .from("stocks")
      .select("*")
      .eq("tenantId", tenantId)
      .eq("tallerId", input.tallerId)
      .eq("productoId", input.productoId)
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
        .eq("tenantId", tenantId)
        .eq("id", existing.id)
        .select("*")
        .single();
      return { data: (data ?? null) as StockRow | null, created: false, error };
    }

    const { data, error } = await supabase
      .from("stocks")
      .insert([{ ...input, tenantId }])
      .select("*")
      .single();
    return { data: (data ?? null) as StockRow | null, created: true, error };
  },

  async updateById(
    supabase: SupabaseClient,
    tenantId: string,
    id: string,
    patch: Partial<Pick<StockRow, "cantidad" | "stock_minimo" | "stock_maximo">>
  ): Promise<{ data: StockRow | null; error: StocksServiceError | PostgrestError | null }> {
    const { data, error } = await supabase
      .from("stocks")
      .update(patch)
      .eq("tenantId", tenantId)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) return { data: null, error };
    if (!data) return { data: null, error: StocksServiceError.NotFound };
    return { data: data as StockRow, error: null };
  },

  async deleteById(
    supabase: SupabaseClient,
    tenantId: string,
    id: string
  ): Promise<{ error: StocksServiceError | PostgrestError | null }> {
    const { error } = await supabase.from("stocks").delete().eq("tenantId", tenantId).eq("id", id);
    if (error) return { error };
    return { error: null };
  },
};

