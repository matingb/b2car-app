import type { SupabaseClient } from "@supabase/supabase-js";
import { ServiceError, ServiceResult, toServiceError } from "@/app/api/serviceError";

const DETALLE_ARREGLO_SELECT = "id, arreglo_id, descripcion, cantidad, valor, created_at, updated_at";

export type DetalleArregloRow = {
  id: string;
  arreglo_id: string;
  descripcion: string;
  cantidad: number;
  valor: number;
  created_at: string;
  updated_at: string;
};

export const detalleArregloService = {
  async listByArregloId(supabase: SupabaseClient, arregloId: string): Promise<ServiceResult<DetalleArregloRow[]>> {
    const { data, error } = await supabase
      .from("detalle_arreglo")
      .select(DETALLE_ARREGLO_SELECT)
      .eq("arreglo_id", arregloId)
      .order("created_at", { ascending: true });

    if (error) return { data: null, error: toServiceError(error) };
    return { data: (data ?? []) as unknown as DetalleArregloRow[], error: null };
  },

  async getById(
    supabase: SupabaseClient,
    arregloId: string,
    detalleId: string
  ): Promise<ServiceResult<DetalleArregloRow>> {
    const { data, error } = await supabase
      .from("detalle_arreglo")
      .select(DETALLE_ARREGLO_SELECT)
      .eq("id", detalleId)
      .eq("arreglo_id", arregloId)
      .single();

    if (error) return { data: null, error: toServiceError(error) };
    return { data: (data ?? null) as unknown as DetalleArregloRow | null, error: null };
  },

  async create(
    supabase: SupabaseClient,
    payload: { arreglo_id: string; descripcion: string; cantidad: number; valor: number }
  ): Promise<ServiceResult<DetalleArregloRow>> {
    const { data, error } = await supabase
      .from("detalle_arreglo")
      .insert(payload)
      .select(DETALLE_ARREGLO_SELECT)
      .single();

    if (error) return { data: null, error: toServiceError(error) };
    return { data: (data ?? null) as unknown as DetalleArregloRow | null, error: null };
  },

  async updateById(
    supabase: SupabaseClient,
    arregloId: string,
    detalleId: string,
    patch: Record<string, unknown>
  ): Promise<ServiceResult<DetalleArregloRow>> {
    const { data, error } = await supabase
      .from("detalle_arreglo")
      .update(patch)
      .eq("id", detalleId)
      .eq("arreglo_id", arregloId)
      .select(DETALLE_ARREGLO_SELECT)
      .single();

    if (error) return { data: null, error: toServiceError(error) };
    return { data: (data ?? null) as unknown as DetalleArregloRow | null, error: null };
  },

  async deleteById(
    supabase: SupabaseClient,
    arregloId: string,
    detalleId: string
  ): Promise<{ error: ServiceError | null }> {
    const { data, error } = await supabase
      .from("detalle_arreglo")
      .delete()
      .eq("id", detalleId)
      .eq("arreglo_id", arregloId)
      .select("id")
      .maybeSingle();

    if (error) return { error: toServiceError(error) };
    if (!data?.id) return { error: ServiceError.NotFound };
    return { error: null };
  },
};

