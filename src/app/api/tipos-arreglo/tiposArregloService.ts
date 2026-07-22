import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { ServiceError, toServiceError } from "@/app/api/serviceError";

export type TipoArregloRow = {
  id: string;
  tenant_id: string;
  nombre: string;
  activo: boolean;
  color: string | null;
  created_at: string;
  updated_at: string;
};

export type ListTiposArregloFilters = {
  soloActivos?: boolean;
};

export type CreateTipoArregloInput = {
  nombre: string;
  color?: string | null;
};

export const tiposArregloService = {
  async list(
    supabase: SupabaseClient,
    filters: ListTiposArregloFilters = {}
  ): Promise<{ data: TipoArregloRow[]; error: ServiceError | null }> {
    let query = supabase.from("tipos_arreglo").select("*").order("nombre", { ascending: true });

    if (filters.soloActivos) {
      query = query.eq("activo", true);
    }

    const { data, error } = await query;
    if (error) return { data: [], error: toServiceError(error) };
    return { data: (data ?? []) as TipoArregloRow[], error: null };
  },

  async create(
    supabase: SupabaseClient,
    payload: CreateTipoArregloInput
  ): Promise<{ data: TipoArregloRow | null; error: ServiceError | PostgrestError | null }> {
    const { data, error } = await supabase
      .from("tipos_arreglo")
      .insert([{ nombre: payload.nombre, color: payload.color ?? null }])
      .select("*")
      .single();

    if (error) return { data: null, error };
    return { data: (data ?? null) as TipoArregloRow | null, error: null };
  },

  async updateById(
    supabase: SupabaseClient,
    id: string,
    patch: Partial<Pick<TipoArregloRow, "nombre" | "activo" | "color">>
  ): Promise<{ data: TipoArregloRow | null; error: ServiceError | PostgrestError | null }> {
    const { data, error } = await supabase
      .from("tipos_arreglo")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) return { data: null, error };
    if (!data) return { data: null, error: ServiceError.NotFound };
    return { data: data as TipoArregloRow, error: null };
  },

  async deleteById(
    supabase: SupabaseClient,
    id: string
  ): Promise<{ error: ServiceError | PostgrestError | null }> {
    const { error, count } = await supabase
      .from("tipos_arreglo")
      .delete({ count: "exact" })
      .eq("id", id);
    if (error) return { error };
    if (!count) return { error: ServiceError.NotFound };
    return { error: null };
  },
} as const;
