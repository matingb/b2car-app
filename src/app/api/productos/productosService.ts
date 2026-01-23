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

export const productosService = {
  async list(
    supabase: SupabaseClient,
    tenantId: string,
    filters: ListProductosFilters = {}
  ): Promise<{ data: ProductoRow[]; error: ProductosServiceError | null }> {
    let query = supabase
      .from("productos")
      .select("*")
      .eq("tenantId", tenantId)
      .order("updated_at", { ascending: false });

    const search = (filters.search ?? "").trim();
    if (search) {
      const q = search.replace(/%/g, "\\%");
      query = query.or(
        [
          `codigo.ilike.%${q}%`,
          `nombre.ilike.%${q}%`,
          `marca.ilike.%${q}%`,
          `modelo.ilike.%${q}%`,
          `descripcion.ilike.%${q}%`,
          `proveedor.ilike.%${q}%`,
        ].join(",")
      );
    }

    const cats = (filters.categorias ?? []).filter(Boolean);
    if (cats.length > 0) {
      // Overlaps: match any category
      query = query.overlaps("categorias", cats);
    }

    const { data, error } = await query;
    if (error) return { data: [], error: toServiceError(error) };
    return { data: (data ?? []) as ProductoRow[], error: null };
  },

  async getById(
    supabase: SupabaseClient,
    tenantId: string,
    id: string
  ): Promise<{ data: ProductoRow | null; error: ProductosServiceError | null }> {
    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .eq("tenantId", tenantId)
      .eq("id", id)
      .maybeSingle();

    if (error) return { data: null, error: toServiceError(error) };
    if (!data) return { data: null, error: ProductosServiceError.NotFound };
    return { data: data as ProductoRow, error: null };
  },

  async create(
    supabase: SupabaseClient,
    tenantId: string,
    payload: Omit<
      ProductoRow,
      "id" | "created_at" | "updated_at"
    >
  ): Promise<{ data: ProductoRow | null; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from("productos")
      .insert([{ ...payload, tenantId }])
      .select("*")
      .single();

    return { data: (data ?? null) as ProductoRow | null, error };
  },

  async updateById(
    supabase: SupabaseClient,
    tenantId: string,
    id: string,
    patch: Partial<
      Pick<
        ProductoRow,
        | "codigo"
        | "nombre"
        | "marca"
        | "modelo"
        | "descripcion"
        | "precio_unitario"
        | "costo_unitario"
        | "proveedor"
        | "categorias"
      >
    >
  ): Promise<{ data: ProductoRow | null; error: ProductosServiceError | PostgrestError | null }> {
    const { data, error } = await supabase
      .from("productos")
      .update(patch)
      .eq("tenantId", tenantId)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) return { data: null, error };
    if (!data) return { data: null, error: ProductosServiceError.NotFound };
    return { data: data as ProductoRow, error: null };
  },

  async deleteById(
    supabase: SupabaseClient,
    tenantId: string,
    id: string
  ): Promise<{ error: ProductosServiceError | PostgrestError | null }> {
    // Best effort: delete dependent stocks first (if FK cascade exists, this is redundant).
    await supabase.from("stocks").delete().eq("tenantId", tenantId).eq("productoId", id);

    const { error } = await supabase.from("productos").delete().eq("tenantId", tenantId).eq("id", id);
    if (error) return { error };
    return { error: null };
  },
};

