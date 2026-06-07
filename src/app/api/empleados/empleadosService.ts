import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { ServiceError, toServiceError } from "@/app/api/serviceError";

export type ListEmpleadosFilters = {
  tallerId?: string;
};

export type EmpleadoRow = {
  id: string;
  tenant_id: string;
  taller_id: string;
  nombre: string;
  apellido: string;
  dni: string;
  email: string | null;
  telefono: string | null;
  cumpleanos: string | null;
  salario: number | null;
  fecha_ingreso: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateEmpleadoInput = Omit<EmpleadoRow, "id" | "tenant_id" | "created_at" | "updated_at">;

export type SalarioHistorialRow = {
  id: string;
  empleado_id: string;
  salario: number;
  vigente_desde: string;
  created_at: string;
};

export const empleadosService = {
  async list(
    supabase: SupabaseClient,
    filters: ListEmpleadosFilters = {}
  ): Promise<{ data: EmpleadoRow[]; error: ServiceError | null }> {
    let query = supabase
      .from("empleados")
      .select("*")
      .order("apellido", { ascending: true })
      .order("nombre", { ascending: true });

    if (filters.tallerId) {
      query = query.eq("taller_id", filters.tallerId);
    }

    const { data, error } = await query;
    if (error) return { data: [], error: toServiceError(error) };
    return { data: (data ?? []) as EmpleadoRow[], error: null };
  },

  async getById(
    supabase: SupabaseClient,
    id: string
  ): Promise<{ data: EmpleadoRow | null; error: ServiceError | null }> {
    const { data, error } = await supabase
      .from("empleados")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) return { data: null, error: toServiceError(error) };
    if (!data) return { data: null, error: ServiceError.NotFound };
    return { data: data as EmpleadoRow, error: null };
  },

  async create(
    supabase: SupabaseClient,
    payload: CreateEmpleadoInput
  ): Promise<{ data: EmpleadoRow | null; error: ServiceError | null }> {
    const { data, error } = await supabase
      .from("empleados")
      .insert([payload])
      .select("*")
      .single();

    if (error) return { data: null, error: toServiceError(error) };
    return { data: (data ?? null) as EmpleadoRow | null, error: null };
  },

  async updateById(
    supabase: SupabaseClient,
    id: string,
    patch: Partial<EmpleadoRow>
  ): Promise<{ data: EmpleadoRow | null; error: ServiceError | PostgrestError | null }> {
    const { data, error } = await supabase
      .from("empleados")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) return { data: null, error };
    if (!data) return { data: null, error: ServiceError.NotFound };
    return { data: data as EmpleadoRow, error: null };
  },

  async deleteById(
    supabase: SupabaseClient,
    id: string
  ): Promise<{ error: ServiceError | PostgrestError | null }> {
    const { error } = await supabase.from("empleados").delete().eq("id", id);
    if (error) return { error };
    return { error: null };
  },

  async recordSalarioChange(
    supabase: SupabaseClient,
    empleadoId: string,
    tallerId: string,
    salario: number,
    vigenteDesde: string
  ): Promise<{ error: ServiceError | PostgrestError | null }> {
    const { error } = await supabase.from("empleado_salarios").upsert(
      [{ empleado_id: empleadoId, taller_id: tallerId, salario, vigente_desde: vigenteDesde }],
      { onConflict: "empleado_id,vigente_desde" }
    );
    if (error) return { error };
    return { error: null };
  },

  async getSalarioHistory(
    supabase: SupabaseClient,
    empleadoId: string
  ): Promise<{ data: SalarioHistorialRow[]; error: ServiceError | PostgrestError | null }> {
    const { data, error } = await supabase
      .from("empleado_salarios")
      .select("id, empleado_id, salario, vigente_desde, created_at")
      .eq("empleado_id", empleadoId)
      .order("vigente_desde", { ascending: false });
    if (error) return { data: [], error };
    return { data: (data ?? []) as SalarioHistorialRow[], error: null };
  },
};
