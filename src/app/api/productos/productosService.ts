import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

export enum ProductosServiceError {
  NotFound = "NotFound",
  Unknown = "Unknown",
}

function toServiceError(err: PostgrestError): ProductosServiceError {
  const code = (err as { code?: string }).code;
  if (code === "PGRST116") return ProductosServiceError.NotFound;
  return ProductosServiceError.Unknown;
}

export type ListProductosFilters = {
  search?: string;
  categorias?: string[];
};

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
  created_at: string;
  updated_at: string;
};

export type ProductoWithStocksCountRow = ProductoRow & {
  talleresConStock: number;
};

export type CreateProductoInput = Omit<ProductoRow, "id" | "tenantId" | "created_at" | "updated_at">;

export const productosService = {
  async list(supabase: SupabaseClient): Promise<{ data: ProductoWithStocksCountRow[]; error: ProductosServiceError | null }> {
    const query = supabase.from("productos").select("*, stocks(count)").order("updated_at", { ascending: false });
    const { data, error } = await query;
    if (error) return { data: [], error: toServiceError(error) };
    const mapped: ProductoWithStocksCountRow[] = data.map((row) => ({
      ...row,
      talleresConStock: Number(row.stocks?.[0]?.count) || 0,
    }));
    return { data: mapped, error: null };
  },

  async getById(
    supabase: SupabaseClient,
    id: string
  ): Promise<{ data: ProductoRow | null; error: ProductosServiceError | null }> {
    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) return { data: null, error: toServiceError(error) };
    if (!data) return { data: null, error: ProductosServiceError.NotFound };
    return { data: data as ProductoRow, error: null };
  },

  async create(
    supabase: SupabaseClient,
    payload: CreateProductoInput
  ): Promise<{ data: ProductoRow | null; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from("productos")
      .insert([payload])
      .select("*")
      .single();

    return { data: (data ?? null) as ProductoRow | null, error };
  },

  async updateById(
    supabase: SupabaseClient,
    id: string,
    patch: Partial<ProductoRow>
  ): Promise<{ data: ProductoRow | null; error: ProductosServiceError | PostgrestError | null }> {
    const { data, error } = await supabase
      .from("productos")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) return { data: null, error };
    if (!data) return { data: null, error: ProductosServiceError.NotFound };
    return { data: data as ProductoRow, error: null };
  },

  async deleteById(
    supabase: SupabaseClient,
    id: string
  ): Promise<{ error: ProductosServiceError | PostgrestError | null }> {
    await supabase.from("stocks").delete().eq("productoId", id);

    const { error } = await supabase.from("productos").delete().eq("id", id);
    if (error) return { error };
    return { error: null };
  },
};

