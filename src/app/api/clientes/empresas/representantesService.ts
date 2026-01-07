import type { SupabaseClient } from "@supabase/supabase-js";
import type { Representante } from "@/model/types";

export const representantesService = {
  async listByEmpresaId(
    supabase: SupabaseClient,
    empresaId: string
  ): Promise<{ data: Representante[]; error: Error | null }> {
    const { data, error } = await supabase
      .from("representantes")
      .select("id, empresa_id, empresa_id, nombre, apellido, telefono")
      .or(`empresa_id.eq.${empresaId},empresa_id.eq.${empresaId}`);

    if (error) return { data: [], error: new Error(error.message) };
    return { data: (data ?? []) as Representante[], error: null };
  },

  async create(
    supabase: SupabaseClient,
    empresaId: string,
    payload: { nombre: string; apellido: string | null; telefono: string | null }
  ): Promise<{ data: Representante | null; error: Error | null }> {
    const insertPayload = { ...payload, empresa_id: empresaId };

    const { data, error } = await supabase
      .from("representantes")
      .insert([insertPayload])
      .eq("empresa_id", empresaId)
      .select("id, nombre, apellido, telefono")
      .single();

    if (error) return { data: null, error: new Error(error.message) };
    return { data: (data ?? null) as Representante | null, error: null };
  },

  async delete(
    supabase: SupabaseClient,
    empresaId: string,
    representanteId: string
  ): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .from("representantes")
      .delete()
      .eq("id", representanteId)
      .eq("empresa_id", empresaId);

    if (error) return { error: new Error(error.message) };
    return { error: null };
  },
};


