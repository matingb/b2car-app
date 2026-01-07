import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";
import { Representante } from "@/model/types";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { representantesService } from "@/app/api/clientes/empresas/representantesService";

// GET /api/clientes/empresas/[id]/representantes
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data, error } = await representantesService.listByEmpresaId(supabase, id);

  if (error) {
    return Response.json({ data: [], error: error.message }, { status: 500 });
  }

  return Response.json({ data: data as Representante[], error: null });
}

export type CreateRepresentanteRequest = {
    nombre: string;
    apellido: string | null;
    telefono: string | null;
    empresa_id: string;
};

export type CreateRepresentanteResponse = {
    data: Representante | null;
    error?: string | null;
};

// POST /api/clientes/empresas/[id]/representantes
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "JSON inválido" }, { status: 400 });

  const { nombre, apellido, telefono } = body as {
    nombre?: string;
    apellido?: string;
    telefono?: string;
  };

  if (!nombre) return Response.json({ error: "Falta nombre" }, { status: 400 });

  // Insert tratando ambos nombres de columnas
  const insertPayload: CreateRepresentanteRequest = {
    nombre: nombre.trim(),
    apellido: apellido?.trim() || null,
    telefono: telefono?.trim() || null,
    empresa_id: id,
  };

  const { data, error: insertError } = await representantesService.create(supabase, id, insertPayload);

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 });  
  }

  await statsService.onDataChanged(supabase);
  return Response.json({ data, error: null }, { status: 201 });
}

export type DeleteRepresentanteResponse = {
  error?: string | null;
};

// DELETE /api/clientes/empresas/[id]/representantes?representanteId=123
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id: empresaId } = await params;

  const { searchParams } = new URL(req.url);
  const representanteId = searchParams.get("representanteId") || searchParams.get("id");
  if (!representanteId) return Response.json({ error: "Falta representanteId" }, { status: 400 });

  const { error } = await representantesService.delete(supabase, empresaId, representanteId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  await statsService.onDataChanged(supabase);
  return Response.json({ error: null }, { status: 200 });
}
