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

  const reps: Representante[] = (data || []).map((r: any) => ({
    id: r.id,
    empresa_id: r.empresa_id ?? r.empresa_id,
    nombre: r.nombre,
    apellido: r.apellido,
    telefono: r.telefono,
  }));

  return Response.json({ data: reps, error: null });
}

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
  const insertPayload: any = {
    nombre: nombre.trim(),
    apellido: apellido?.trim() || null,
    telefono: telefono?.trim() || null,
    empresa_id: id,
  };

  // Si el esquema usa empresa_id en lugar de empresa_id
  const { error: insertError } = await supabase
    .from("representantes")
    .insert([insertPayload]);

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  return Response.json({ error: null }, { status: 201 });
}
