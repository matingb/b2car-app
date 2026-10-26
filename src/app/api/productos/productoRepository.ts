import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { StockRow } from "../stocks/stocksService";

export type ProductoRow = {
  id: string;
  tenantId: string;
  codigo: string;
  nombre: string;
  marca: string | null;
  modelo: string | null;
  descripcion: string | null;
  precio_unitario: number;
  costo_unitario: number;
  proveedor: string | null;
  categorias: string[] | null;
  show_in_stock: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductoWithStocksRow = ProductoRow & {
  talleresConStock: number;
  stocks: StockRow[];
};

export type CreateProductoInput = Omit<ProductoRow, "id" | "tenantId" | "created_at" | "updated_at">;

export type ListProductosFilters = {
  search?: string;
  categorias?: string[];
  proveedorId?: string;
};

export interface ProductoRepository {
  list(
    supabase: SupabaseClient,
    filters?: ListProductosFilters
  ): Promise<{ data: ProductoWithStocksRow[]; error: PostgrestError | null }>;
  getById(supabase: SupabaseClient, id: string): Promise<{ data: ProductoRow | null; error: PostgrestError | null }>;
  getStocksByProductoId(supabase: SupabaseClient, productoId: string): Promise<{ data: StockRow[]; error: PostgrestError | null }>;
  create(supabase: SupabaseClient, payload: CreateProductoInput): Promise<{ data: ProductoRow | null; error: PostgrestError | null }>;
  updateById(supabase: SupabaseClient, id: string, patch: Partial<ProductoRow>): Promise<{ data: ProductoRow | null; error: PostgrestError | null }>;
  deleteById(supabase: SupabaseClient, id: string): Promise<{ error: PostgrestError | null }>;
}

export const supabaseProductoRepository: ProductoRepository = {
  async list(supabase: SupabaseClient, filters?: ListProductosFilters) {
    let productIds: string[] | null = null;

    if (filters?.proveedorId) {
      const { data: ppRows, error: ppError } = await supabase
        .from("productos_proveedores")
        .select("producto_id")
        .eq("proveedor_id", filters.proveedorId);

      if (ppError) return { data: [], error: ppError };

      const ids = new Set<string>((ppRows ?? []).map((r: { producto_id: string }) => r.producto_id));

      const { data: prov } = await supabase
        .from("proveedores")
        .select("nombre")
        .eq("id", filters.proveedorId)
        .maybeSingle();

      if (prov?.nombre) {
        const { data: legacyProds } = await supabase
          .from("productos")
          .select("id")
          .eq("proveedor", prov.nombre);

        (legacyProds ?? []).forEach((p: { id: string }) => ids.add(p.id));
      }

      productIds = Array.from(ids);
      if (productIds.length === 0) {
        return { data: [], error: null };
      }
    }

    let query = supabase
      .from("productos")
      .select("*, stocks(*)")
      .order("nombre", { ascending: true });

    if (productIds !== null) {
      query = query.in("id", productIds);
    }

    const { data, error } = await query;

    if (error) return { data: [], error };
    const mapped: ProductoWithStocksRow[] = (data ?? []).map((row: Record<string, unknown>) => ({
      ...(row as unknown as ProductoWithStocksRow),
      stocks: Array.isArray(row.stocks) ? row.stocks : [],
      talleresConStock: Array.isArray(row.stocks) ? row.stocks.length : 0,
    }));
    return { data: mapped, error: null };
  },

  async getById(supabase: SupabaseClient, id: string) {
    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    return { data: (data ?? null) as ProductoRow | null, error };
  },

  async getStocksByProductoId(supabase: SupabaseClient, productoId: string) {
    const { data, error } = await supabase
      .from("stocks")
      .select("*")
      .eq("producto_id", productoId);

    return { data: (data ?? []) as StockRow[], error };
  },

  async create(supabase: SupabaseClient, payload: CreateProductoInput) {
    const { data, error } = await supabase
      .from("productos")
      .insert([payload])
      .select("*")
      .single();

    return { data: (data ?? null) as ProductoRow | null, error };
  },

  async updateById(supabase: SupabaseClient, id: string, patch: Partial<ProductoRow>) {
    const { data, error } = await supabase
      .from("productos")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    return { data: (data ?? null) as ProductoRow | null, error };
  },

  async deleteById(supabase: SupabaseClient, id: string) {
    await supabase.from("stocks").delete().eq("producto_id", id);
    const { error } = await supabase.from("productos").delete().eq("id", id);
    return { error };
  },
};
