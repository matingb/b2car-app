import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";

export type DeleteRepuestoLineaResponse = {
  error?: string | null;
};

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; lineaId: string }> }
) {
  const supabase = await createClient();
  const { id: arregloId, lineaId } = await params;

  if (!arregloId) {
    return Response.json({ error: "Falta arreglo_id" } satisfies DeleteRepuestoLineaResponse, { status: 400 });
  }
  if (!lineaId) {
    return Response.json({ error: "Falta lineaId" } satisfies DeleteRepuestoLineaResponse, { status: 400 });
  }

  // Verificar pertenencia de la línea al arreglo (y a una operación asignación)
  const { data: ownsRow, error: ownsErr } = await supabase
    .from("operaciones_lineas")
    .select("id, operacion_id, asig:operaciones_asignacion_arreglo!inner(arreglo_id)")
    .eq("id", lineaId)
    .eq("asig.arreglo_id", arregloId)
    .maybeSingle();

  if (ownsErr) {
    return Response.json({ error: "Error validando repuesto" } satisfies DeleteRepuestoLineaResponse, { status: 500 });
  }
  if (!ownsRow?.id) {
    return Response.json({ error: "Repuesto no encontrado" } satisfies DeleteRepuestoLineaResponse, { status: 404 });
  }

  const { error } = await supabase.rpc("rpc_delete_asignacion_arreglo_linea", {
    p_operacion_linea_id: lineaId,
  });

  if (error) {
    return Response.json({ error: "Error eliminando repuesto" } satisfies DeleteRepuestoLineaResponse, { status: 500 });
  }

  return Response.json({ error: null } satisfies DeleteRepuestoLineaResponse, { status: 200 });
}

