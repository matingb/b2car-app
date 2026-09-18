import type { NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import { requirePermission } from "@/lib/requirePermission";
import { Permission } from "@/lib/permissions";
import { empleadosService } from "../../empleadosService";
import type { GetSalarioHistorialResponse, SalarioHistorialDTO } from "../../contracts";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requirePermission(Permission.EmpleadosView);
  if (authError) return authError;

  const supabase = await createClient();

  const { id } = await params;
  if (!id) {
    return Response.json(
      { data: null, error: "Falta id" } satisfies GetSalarioHistorialResponse,
      { status: 400 }
    );
  }

  const { data, error } = await empleadosService.getSalarioHistory(supabase, id);
  if (error) {
    return Response.json(
      { data: null, error: "Error obteniendo historial salarial" } satisfies GetSalarioHistorialResponse,
      { status: 500 }
    );
  }

  const mapped: SalarioHistorialDTO[] = data.map((row) => ({
    id: row.id,
    empleadoId: row.empleado_id,
    salario: Number(row.salario),
    vigenteDesde: row.vigente_desde,
    createdAt: row.created_at,
  }));

  return Response.json(
    { data: mapped, error: null } satisfies GetSalarioHistorialResponse,
    { status: 200 }
  );
}
