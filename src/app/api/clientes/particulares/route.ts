import { Cliente } from "@/model/types";
import { createClient } from "@/supabase/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { particularService } from "./particularService";

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

  const { data, error } = await particularService.createClienteParticular(supabase, payload);
  if (error || !data) {
    return Response.json({ error: error?.message || "No se pudo crear el particular" }, { status: 500 });
  }

  await statsService.onDataChanged(supabase);
  return Response.json({ data }, { status: 201 });
}


