import { Cliente } from "@/model/types";
import { createClient } from "@/supabase/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { particularService } from "./particularService";
import { isValidDniCuil, normalizeDniCuil } from "@/lib/documentos";

export type CreateParticularRequest = {
  nombre: string;
  apellido?: string;
  codigo_pais?: string;
  telefono: string;
  email: string;
  direccion: string;
  /** DNI (7/8 dígitos) o CUIL (11 dígitos). */
  dni_cuil?: string | null;
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
  const dniCuil = normalizeDniCuil(payload.dni_cuil);
  if (dniCuil && !isValidDniCuil(dniCuil)) {
    return Response.json({ error: "El DNI/CUIL debe tener 7 u 8 dígitos para DNI, u 11 para CUIL" }, { status: 400 });
  }

  const { data, error } = await particularService.createClienteParticular(supabase, {
    ...payload,
    dni_cuil: dniCuil,
  });
  if (error || !data) {
    if (error?.code === "23505") {
      return Response.json({ error: "Ya existe un particular con ese DNI/CUIL" }, { status: 409 });
    }
    return Response.json({ error: error?.message || "No se pudo crear el particular" }, { status: 500 });
  }

  await statsService.onDataChanged(supabase);
  return Response.json({ data }, { status: 201 });
}


