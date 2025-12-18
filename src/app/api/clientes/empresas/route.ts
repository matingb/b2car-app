import { TipoCliente, Cliente } from "@/model/types";
import { createClient } from "@/supabase/server";
import { empresaService } from "./empresaService";
import { logger } from "@/lib/logger";
import { decodeJwtPayload } from "@/utils/jwt";

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

  const { data } = await supabase.auth.getSession();
  const jwt = decodeJwtPayload(data.session?.access_token || "");
  const tenantId = jwt?.tenant_id as string | null;
  logger.debug("Tenant ID del usuario:", tenantId);

  // TODO
  /*
  *
  * Si dos usuarios del mismo tenant intentan crear con el mismo CUIT al MISMO MOMENTO,
  * se da una condicion de carrera y es posible que se creen dos empresas con el mismo CUIT.
  * Revisar implementacion eventualmente para resolver la condicion de carrera
  * 
  * ↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓
  */
  const empresaExist = (await empresaService.fetchByCuitAndTenantId(supabase, payload.cuit, tenantId)).data;

  if (empresaExist){
    logger.error(`Intento de creación de empresa con CUIT existente: ${payload.cuit}`);
    return Response.json({ error: "Empresa con cuit " + payload.cuit + " ya existe" }, { status: 409 });
  }

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
