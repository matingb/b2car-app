import type { SupabaseClient } from "@supabase/supabase-js";
import { ServiceError, toServiceError } from "@/app/api/serviceError";
import { buildArregloDescripcion } from "@/lib/arreglos";



export async function syncArregloDescripcion(
  supabase: SupabaseClient,
  arregloId: string
): Promise<{ descripcion: string | null; error: ServiceError | null }> {
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "rpc_get_arreglo_detalle",
    { p_arreglo_id: arregloId }
  );

  if (rpcError || !rpcData) {
    return { descripcion: null, error: rpcError ? toServiceError(rpcError) : ServiceError.NotFound };
  }

  const rpc = rpcData as {
    arreglo?: unknown;
    detalles?: unknown[];
    asignaciones?: unknown[];
  };

  const detalles = Array.isArray(rpc.detalles) ? rpc.detalles : [];
  const asignaciones = Array.isArray(rpc.asignaciones) ? rpc.asignaciones : [];

  const categoriaIds = new Set<string>();
  const empleadoIds = new Set<string>();

  (detalles as Record<string, unknown>[]).forEach((d) => {
    if (typeof d.categoria_arreglo_id === "string") categoriaIds.add(d.categoria_arreglo_id);
    if (typeof d.empleado_id === "string") empleadoIds.add(d.empleado_id);
  });

  (asignaciones as Record<string, unknown>[]).forEach((a) => {
    if (Array.isArray(a.lineas)) {
      (a.lineas as Record<string, unknown>[]).forEach((l) => {
        if (typeof l.categoria_arreglo_id === "string") categoriaIds.add(l.categoria_arreglo_id);
        if (typeof l.empleado_id === "string") empleadoIds.add(l.empleado_id);
      });
    }
  });

  const categoriasArray = Array.from(categoriaIds);
  const empleadosArray = Array.from(empleadoIds);

  const { data: detalleFormularioRows } = await supabase
    .from("detalle_form_custom")
    .select("metadata")
    .eq("arreglo_id", arregloId)
    .order("created_at", { ascending: false })
    .limit(1);
    
  const detalleFormulario = detalleFormularioRows?.[0] ?? null;

  const descripcion = buildArregloDescripcion({

    detalles: detalles as Record<string, unknown>[],
    detalleFormulario,
  });

  const updatePayload = {
    descripcion,

    categorias: categoriasArray,
    empleados: empleadosArray,
  };

  const { data: updatedRow, error: updateError } = await supabase
    .from("arreglos")
    .update(updatePayload)
    .eq("id", arregloId)
    .select("id")
    .maybeSingle();

  if (updateError || !updatedRow?.id) {
    return { descripcion: null, error: updateError ? toServiceError(updateError) : ServiceError.NotFound };
  }

  return { descripcion, error: null };
}
