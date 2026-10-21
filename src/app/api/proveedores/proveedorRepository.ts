import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { ServiceError, serviceFailure, toServiceError } from "@/app/api/serviceError";

export type ProveedorRow = {
  id: string;
  tenant_id: string;
  nombre: string;
  cuit: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  created_at: string;
  updated_at: string;
};

export type ListProveedoresFilters = {
  search?: string;
  limit?: number;
};

export type CreateProveedorPayload = {
  nombre: string;
  cuit: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
};

export type UpdateProveedorPayload = {
  nombre?: string;
  cuit?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
};

export interface ProveedorRepository {
  list(
    supabase: SupabaseClient,
    filters?: ListProveedoresFilters
  ): Promise<{ data: ProveedorRow[]; error: ServiceError | null; cause?: PostgrestError }>;

  getById(
    supabase: SupabaseClient,
    id: string
  ): Promise<{ data: ProveedorRow | null; error: ServiceError | PostgrestError | null }>;

  create(
    supabase: SupabaseClient,
    payload: CreateProveedorPayload
  ): Promise<{ data: ProveedorRow | null; error: ServiceError | PostgrestError | null }>;

  updateById(
    supabase: SupabaseClient,
    id: string,
    payload: UpdateProveedorPayload
  ): Promise<{ data: ProveedorRow | null; error: ServiceError | PostgrestError | null }>;

  deleteById(
    supabase: SupabaseClient,
    id: string
  ): Promise<{ error: ServiceError | PostgrestError | null }>;
}

export const supabaseProveedorRepository: ProveedorRepository = {
  async list(supabase: SupabaseClient, filters?: ListProveedoresFilters) {
    let query = supabase
      .from("proveedores")
      .select("*")
      .order("nombre", { ascending: true });

    const search = filters?.search?.trim();
    if (search) {
      query = query.or(`nombre.ilike.%${search}%,cuit.ilike.%${search}%`);
    }

    if (filters?.limit && filters.limit > 0) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (error) return { data: [], ...serviceFailure(error) };
    return { data: (data ?? []) as ProveedorRow[], error: null };
  },

  async getById(supabase: SupabaseClient, id: string) {
    const { data, error } = await supabase
      .from("proveedores")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) return { data: null, error };
    if (!data) return { data: null, error: ServiceError.NotFound };
    return { data: data as ProveedorRow, error: null };
  },

  async create(supabase: SupabaseClient, payload: CreateProveedorPayload) {
    const { data, error } = await supabase
      .from("proveedores")
      .insert([payload])
      .select("*")
      .single();

    if (error) {
      return {
        data: null,
        error: toServiceError(error) === ServiceError.Conflict ? ServiceError.Conflict : error,
      };
    }
    return { data: (data ?? null) as ProveedorRow | null, error: null };
  },

  async updateById(supabase: SupabaseClient, id: string, payload: UpdateProveedorPayload) {
    const { data, error } = await supabase
      .from("proveedores")
      .update(payload)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      return {
        data: null,
        error: toServiceError(error) === ServiceError.Conflict ? ServiceError.Conflict : error,
      };
    }
    if (!data) return { data: null, error: ServiceError.NotFound };
    return { data: data as ProveedorRow, error: null };
  },

  async deleteById(supabase: SupabaseClient, id: string) {
    const { error, count } = await supabase
      .from("proveedores")
      .delete({ count: "exact" })
      .eq("id", id);

    if (error) return { error };
    if (!count) return { error: ServiceError.NotFound };
    return { error: null };
  },
};
