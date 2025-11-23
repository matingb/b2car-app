import { TipoCliente, Cliente } from "@/model/types";
import { createClient } from "@/supabase/server";

export type CreateParticularRequest = {
  nombre: string;
  apellido?: string;
  telefono: string;
  email: string;
  direccion: string;
};

export type CreateParticularResponse = {
  data: Cliente | null;
  error?: string | null;
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const payload: CreateParticularRequest | null = await req.json().catch(() => null);
  if (!payload) return Response.json({ error: "JSON inválido" }, { status: 400 });

  if (!payload.nombre) return Response.json({ error: "Falta nombre" }, { status: 400 });

  const { data: clienteInsert, error: errorCliente } = await supabase
    .from("clientes")
    .insert([{ tipo_cliente: TipoCliente.PARTICULAR }])
    .select("id, tipo_cliente")
    .single();

  if (errorCliente || !clienteInsert) {
    console.error('Error creando cliente', errorCliente);
    return Response.json({ error: errorCliente?.message || "No se pudo crear el particular" }, { status: 500 });
  }

  const clienteId = clienteInsert.id;

  const { data, error: detalleError } = await supabase
    .from("particulares")
    .insert([{ ...payload, id: clienteId }])
    .select()
    .single();

  if (detalleError || !data) {
    console.error('Error creando particular', detalleError);
    return Response.json({ error: detalleError?.message || "No se pudo crear el particular" }, { status: 500 });
  }

  return Response.json({
    data: {
      id: clienteId,
      nombre: data.nombre,
      tipo_cliente: TipoCliente.PARTICULAR,
      apellido: data.apellido,
      telefono: data.telefono,
      email: data.email,
      direccion: data.direccion,
    },
  }, { status: 201 });
}


