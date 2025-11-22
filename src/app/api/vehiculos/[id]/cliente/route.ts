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

  // Actualizar relación
  const { error: updateError } = await supabase
    .from("vehiculos")
    .update({ cliente_id: nuevoClienteId })
    .eq("id", id);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ error: null }, { status: 200 });
}

