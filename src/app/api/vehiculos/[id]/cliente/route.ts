import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { VehiculoClienteServiceError, vehiculoService } from "../../vehiculoService";

// GET /api/vehiculos/[id]/cliente
// Devuelve los datos del cliente propietario del vehículo
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data, error } = await vehiculoService.getClienteByVehiculoId(supabase, id);
  if (error) {
    const status =
      error === VehiculoClienteServiceError.NotFound || error === VehiculoClienteServiceError.NoClienteAsignado
        ? 404
        : 500;
    const message =
      error === VehiculoClienteServiceError.NotFound
        ? "Vehículo no encontrado"
        : error === VehiculoClienteServiceError.NoClienteAsignado
          ? "Vehículo sin cliente asignado"
          : "Error cargando cliente del vehículo";
    return Response.json({ data: null, error: message }, { status });
  }

  return Response.json({ data: data, error: null });
}

// PUT /api/vehiculos/[id]/cliente
// Actualiza el cliente (propietario) asociado a un vehículo
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  let body: { cliente_id?: number | string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nuevoClienteId = body.cliente_id;
  if (!nuevoClienteId) {
    return Response.json({ error: "Falta cliente_id" }, { status: 400 });
  }

  /*

  TODO : ... Revisar si realmente es hace falta tanto checkeo ...

  // Verificar vehículo existente
  const { data: vehiculoData, error: vehiculoError } = await supabase
    .from("vehiculos")
    .select("cliente_id")
    .eq("id", id)
    .single();

  if (vehiculoError || !vehiculoData) {
    return Response.json({ error: "Vehículo no encontrado" }, { status: 404 });
  }


  // Verificar cliente destino
  const { data: clienteCheck, error: clienteCheckError } = await supabase
    .from("clientes")
    .select("id")
    .eq("id", nuevoClienteId)
    .single();
  if (clienteCheckError || !clienteCheck) {
    return Response.json({ error: "Cliente destino no encontrado" }, { status: 404 });
  }

  */

  const { error: updateError } = await vehiculoService.updateCliente(supabase, id, nuevoClienteId);
  if (updateError) return Response.json({ error: updateError.message }, { status: 500 });

  await statsService.onDataChanged(supabase);
  return Response.json({ error: null }, { status: 200 });
}

