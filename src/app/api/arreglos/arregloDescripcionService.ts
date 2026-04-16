import type { SupabaseClient } from "@supabase/supabase-js";
import { ServiceError, type ServiceResult, toServiceError } from "@/app/api/serviceError";
import { buildArregloDescripcion } from "@/lib/arreglos";
import { detalleArregloService } from "./detalleArregloService";

export async function computeArregloDescripcion(
  supabase: SupabaseClient,
  arregloId: string,
  overrides?: { tipo?: string }
): Promise<ServiceResult<string>> {
  const { data: arregloRow, error: arregloError } = await supabase
    .from("arreglos")
    .select("tipo, detalle_form_custom(metadata)")
    .eq("id", arregloId)
    .single();

  if (arregloError) {
    return { data: null, error: toServiceError(arregloError) };
  }

  const { data: detalles, error: detallesError } = await detalleArregloService.listByArregloId(
    supabase,
    arregloId
  );

  if (detallesError) {
    return { data: null, error: detallesError };
  }

console.log("arregloRow", arregloRow);

  return {
    data: buildArregloDescripcion({
      tipo: overrides?.tipo ?? arregloRow?.tipo,
      detalles,
      detalleFormulario: arregloRow?.detalle_form_custom ?? null,
    }),
    error: null,
  };
}

export async function syncArregloDescripcion(
  supabase: SupabaseClient,
  arregloId: string,
  overrides?: { tipo?: string }
): Promise<{ descripcion: string | null; error: ServiceError | null }> {
  const { data: descripcion, error: descripcionError } = await computeArregloDescripcion(
    supabase,
    arregloId,
    overrides
  );

  if (descripcionError || !descripcion) {
    return { descripcion: null, error: descripcionError ?? ServiceError.NotFound };
  }

  const { data: updatedRow, error: updateError } = await supabase
    .from("arreglos")
    .update({ descripcion })
    .eq("id", arregloId)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return { descripcion: null, error: toServiceError(updateError) };
  }

  if (!updatedRow?.id) {
    return { descripcion: null, error: ServiceError.NotFound };
  }

  return { descripcion, error: null };
}
