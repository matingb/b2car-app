import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";
import { Representante } from "@/model/types";

// GET /api/clientes/empresas/[id]/representantes
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  // Intentamos soportar columna empresa_id o empresa_id según esquema
  const { data, error } = await supabase
    .from("representantes")
    .select("id, empresa_id, empresa_id, nombre, apellido, telefono")
    .or(`empresa_id.eq.${id},empresa_id.eq.${id}`);

  if (error) {
    return Response.json({ data: [], error: error.message }, { status: 500 });
  }

  const reps: Representante[] = (data || []).map((r: Representante) => ({
    id: r.id,
    empresa_id: r.empresa_id ?? r.empresa_id,
    nombre: r.nombre,
    apellido: r.apellido,
    telefono: r.telefono,
  }));

  return Response.json({ data: reps, error: null });
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

  // Si el esquema usa empresa_id en lugar de empresa_id
  const { data, error: insertError } = await supabase
    .from("representantes")
    .insert([insertPayload])
    .eq("empresa_id", id)
    .select("id, nombre, apellido, telefono")
    .single();

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 });
  }

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

  const { error } = await supabase
    .from("representantes")
    .delete()
    .eq("id", representanteId)
    .eq("empresa_id", empresaId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ error: null }, { status: 200 });
}
