import type { NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import { requirePermission } from "@/lib/requirePermission";
import { Permission } from "@/lib/permissions";
import { clienteOperacionesService } from "../../clienteOperacionesService";
import type { ClienteOperacionesResumen } from "@/model/dtos";
import { ServiceError } from "@/app/api/serviceError";

export type GetClienteOperacionesResponse = {
  data: ClienteOperacionesResumen | null;
  error?: string | null;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requirePermission(Permission.ClientesView);
  if (authError) return authError;

  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await clienteOperacionesService.getOperaciones(supabase, id);

  if (error) {
    const status = error === ServiceError.Validation ? 400 : 500;
    return Response.json(
      { data: null, error: "Error al cargar ventas y operaciones del cliente" } satisfies GetClienteOperacionesResponse,
      { status }
    );
  }

  return Response.json({ data, error: null } satisfies GetClienteOperacionesResponse);
}
