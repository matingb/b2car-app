import { TipoCliente } from "@/model/types";
import { createClient } from "@/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "JSON inválido" }, { status: 400 });

  const { nombre, telefono, email, direccion } = body as {
    nombre: string;
    telefono: string;
    email: string;
    direccion: string;
  };

  if (!nombre) return Response.json({ error: "Falta nombre" }, { status: 400 });

  const { data: clienteInsert, error: errorCliente } = await supabase
    .from("clientes")
    .insert([{ tipo_cliente: TipoCliente.EMPRESA }])
    .select("id, tipo_cliente")
    .single();

  if (errorCliente || !clienteInsert)
    return Response.json({ error: errorCliente?.message || "No se pudo crear" }, { status: 500 });

  const clienteId = clienteInsert.id;

  const { error: detalleError } = await supabase
    .from("empresas")
    .insert([{ id: clienteId, nombre, telefono, email, direccion }]);

  if (detalleError) {
    await supabase.from("clientes").delete().eq("id", clienteId);
    return Response.json({ error: detalleError.message }, { status: 500 });
  }

  return Response.json({
    data: {
      id: clienteId,
      nombre,
      tipo_cliente: TipoCliente.EMPRESA,
      telefono,
      email,
      direccion,
    },
  }, { status: 201 });
}


