import { TipoCliente, Cliente } from "@/model/types";
import { createClient } from "@/supabase/server";

export type CreateEmpresaRequest = {
  nombre: string;
  cuit: string;
  telefono: string;
  email: string;
  direccion: string;
};

export type CreateEmpresaResponse = {
  data: Cliente | null;
  error?: string | null;
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const payload: CreateEmpresaRequest | null = await req.json().catch(() => null);
  if (!payload) return Response.json({ error: "JSON inválido" }, { status: 400 });

  if (!payload.nombre) return Response.json({ error: "Falta nombre" }, { status: 400 });
  if (!payload.cuit) return Response.json({ error: "Falta CUIT" }, { status: 400 });

  const { data: clienteInsert, error: errorCliente } = await supabase
    .from("clientes")
    .insert([{ tipo_cliente: TipoCliente.EMPRESA }])
    .select("id, tipo_cliente")
    .single();

  if (errorCliente || !clienteInsert)
    return Response.json({ error: errorCliente?.message || "No se pudo crear" }, { status: 500 });

  const clienteId = clienteInsert.id;

  const { data: empresaInsert, error: detalleError } = await supabase
    .from("empresas")
    .insert([{ ...payload, id: clienteId, }])
    .select()
    .single();

  if (detalleError || !empresaInsert) {
    await supabase.from("clientes").delete().eq("id", clienteId);
    return Response.json({ error: detalleError?.message || "No se pudo crear la empresa" }, { status: 500 });
  }

  return Response.json({
    data: {
      id: clienteId,
      nombre: empresaInsert.nombre,
      cuit: empresaInsert.cuit,
      tipo_cliente: TipoCliente.EMPRESA,
      telefono: empresaInsert.telefono,
      email: empresaInsert.email,
      direccion: empresaInsert.direccion,
    },
  }, { status: 201 });
}


