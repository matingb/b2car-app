import { Cliente } from "@/model/types";
import { createClient } from "@/supabase/server";
import { empresaService } from "./empresaService";
import { logger } from "@/lib/logger";
import { decodeJwtPayload } from "@/lib/jwt";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";

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

  const { data: created, error: createError } = await empresaService.createClienteEmpresa(supabase, payload);
  if (createError || !created) {
    return Response.json({ error: createError?.message || "No se pudo crear la empresa" }, { status: 500 });
  }

  await statsService.onDataChanged(supabase);
  return Response.json({ data: created }, { status: 201 });
}
