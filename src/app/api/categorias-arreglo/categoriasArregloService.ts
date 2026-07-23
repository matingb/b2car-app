import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { ServiceError, toServiceError } from "@/app/api/serviceError";

export type CategoriaArregloRow = {
  id: string;
  tenant_id: string;
  nombre: string;
  created_at: string;
  updated_at: string;
};

export type ListCategoriasArregloFilters = {
};

export type CreateCategoriaArregloInput = {
  nombre: string;
};

export const categoriasArregloService = {
  async list(
    supabase: SupabaseClient,
    filters: ListCategoriasArregloFilters = {}
  ): Promise<{ data: CategoriaArregloRow[]; error: ServiceError | null }> {
    let query = supabase.from("categorias_arreglo").select("*").order("nombre", { ascending: true });

    const { data, error } = await query;
    if (error) return { data: [], error: toServiceError(error) };
    return { data: (data ?? []) as CategoriaArregloRow[], error: null };
  },

  async create(
    supabase: SupabaseClient,
    payload: CreateCategoriaArregloInput
  ): Promise<{ data: CategoriaArregloRow | null; error: ServiceError | PostgrestError | null }> {
    const { data, error } = await supabase
      .from("categorias_arreglo")
      .insert([{ nombre: payload.nombre }])
      .select("*")
      .single();

    if (error) return { data: null, error };
    return { data: (data ?? null) as CategoriaArregloRow | null, error: null };
  },

  async updateById(
    supabase: SupabaseClient,
    id: string,
    patch: Partial<Pick<CategoriaArregloRow, "nombre">>
  ): Promise<{ data: CategoriaArregloRow | null; error: ServiceError | PostgrestError | null }> {
    const { data, error } = await supabase
      .from("categorias_arreglo")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) return { data: null, error };
    if (!data) return { data: null, error: ServiceError.NotFound };
    return { data: data as CategoriaArregloRow, error: null };
  },

  async deleteById(
    supabase: SupabaseClient,
    id: string
  ): Promise<{ error: ServiceError | PostgrestError | null }> {
    const { error, count } = await supabase
      .from("categorias_arreglo")
      .delete({ count: "exact" })
      .eq("id", id);
    if (error) return { error };
    if (!count) return { error: ServiceError.NotFound };
    return { error: null };
  },
} as const;
