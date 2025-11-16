import { Cliente, TipoCliente } from "@/model/types";
import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";

// GET /api/vehiculos/[id]/cliente
// Devuelve los datos del cliente propietario del vehículo
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  // 1) Obtener cliente_id del vehículo
  const { data: vData, error: vError } = await supabase
    .from("vehiculos")
    .select("cliente_id")
    .eq("id", id)
    .single();

  if (vError) {
    const status = (vError as any)?.code === "PGRST116" ? 404 : 500;
    return Response.json(
      { data: null, error: vError.message },
      { status }
    );
  }

  if (!vData?.cliente_id) {
    return Response.json(
      { data: null, error: "Vehículo sin cliente asignado" },
      { status: 404 }
    );
  }

  // 2) Obtener datos completos del cliente
  const { data: cData, error: cError } = await supabase
    .from("clientes")
    .select("*, particular:particulares(*), empresa:empresas(*)")
    .eq("id", vData.cliente_id)
    .single();

  if (cError) {
    const status = (cError as any)?.code === "PGRST116" ? 404 : 500;
    return Response.json(
      { data: null, error: cError.message },
      { status }
    );
  }

  // 3) Construir objeto Cliente
  const particular = cData.particular;
  const empresa = cData.empresa;

  const cliente: Cliente = {
    id: cData.id,
    nombre: particular
      ? `${particular.nombre} ${particular.apellido}`.trim()
      : empresa?.nombre || "",
    tipo_cliente: cData.tipo_cliente as TipoCliente,
    telefono: particular?.telefono || empresa?.telefono || "",
    email: particular?.email || empresa?.email || "",
    direccion: particular?.direccion || empresa?.direccion || "",
  };

  return Response.json({ data: cliente, error: null });
}

