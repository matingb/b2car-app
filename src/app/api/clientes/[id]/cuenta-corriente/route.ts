import { createClient } from "@/supabase/server";
import { NextRequest } from "next/server";
import type { ClienteMovimientoCuenta } from "@/model/types";
import { clienteFinanzasService } from "../../clienteFinanzasService";
import { requirePermission } from "@/lib/requirePermission";
import { Permission } from "@/lib/permissions";

export type GetClienteCuentaCorrienteResponse = {
  data: ClienteMovimientoCuenta[] | null;
  error?: string | null;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requirePermission(Permission.ClientesFinanzasView);
  if (authError) return authError;

  const supabase = await createClient();
  const { id } = await params;
  const searchParams = req.nextUrl.searchParams;
  const from = searchParams.get("from") || null;
  const to = searchParams.get("to") || null;

  if (!id) {
    return Response.json({ data: null, error: "ID de cliente requerido" }, { status: 400 });
  }

  const { data, error } = await clienteFinanzasService.getCuentaCorriente(supabase, id, {
    from,
    to,
  });

  if (error) {
    return Response.json({ data: null, error: error.message }, { status: 500 });
  }

  return Response.json({ data, error: null });
}
