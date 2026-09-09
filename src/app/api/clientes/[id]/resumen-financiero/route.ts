import { createClient } from "@/supabase/server";
import { NextRequest } from "next/server";
import type { ClienteResumenFinanciero } from "@/model/types";
import { clienteFinanzasService } from "../../clienteFinanzasService";

export type GetClienteResumenFinancieroResponse = {
  data: ClienteResumenFinanciero | null;
  error?: string | null;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  if (!id) {
    return Response.json({ data: null, error: "ID de cliente requerido" }, { status: 400 });
  }

  const { data, error } = await clienteFinanzasService.getResumenFinanciero(supabase, id);
  if (error) {
    return Response.json({ data: null, error: error.message }, { status: 500 });
  }

  return Response.json({ data, error: null });
}
