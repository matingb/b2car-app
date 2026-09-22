import type { NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import { requirePermission } from "@/lib/requirePermission";
import { Permission } from "@/lib/permissions";
import { tallerService } from "../../tallerService";
import type { UpdateTallerPatch, UpdateTallerResponse } from "@/clients/tenantClient";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const authError = await requirePermission(Permission.ConfiguracionView);
  if (authError) return authError;

  const { id } = await params;
  if (!id || typeof id !== "string" || !id.trim()) {
    return Response.json(
      { data: null, error: "Falta id de taller" } satisfies UpdateTallerResponse,
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return Response.json(
      { data: null, error: "JSON inválido" } satisfies UpdateTallerResponse,
      { status: 400 }
    );
  }

  const patch: UpdateTallerPatch = {};

  if (body.nombre !== undefined) {
    if (typeof body.nombre !== "string" || !body.nombre.trim()) {
      return Response.json(
        { data: null, error: "El nombre es obligatorio" } satisfies UpdateTallerResponse,
        { status: 400 }
      );
    }
    patch.nombre = body.nombre.trim();
  }

  if (body.ubicacion !== undefined) {
    if (typeof body.ubicacion !== "string") {
      return Response.json(
        { data: null, error: "Ubicación inválida" } satisfies UpdateTallerResponse,
        { status: 400 }
      );
    }
    patch.ubicacion = body.ubicacion.trim();
  }

  if (body.valor_hora !== undefined) {
    const num = Number(body.valor_hora);
    if (isNaN(num) || num < 0) {
      return Response.json(
        {
          data: null,
          error: "El precio por hora debe ser un número mayor o igual a 0",
        } satisfies UpdateTallerResponse,
        { status: 400 }
      );
    }
    patch.valor_hora = num;
  }

  const supabase = await createClient();
  const { data, error } = await tallerService.updateTaller(supabase, id.trim(), patch);

  if (error) {
    return Response.json(
      { data: null, error } satisfies UpdateTallerResponse,
      { status: 500 }
    );
  }

  return Response.json(
    { data, error: null } satisfies UpdateTallerResponse,
    { status: 200 }
  );
}
