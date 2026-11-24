import type { NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import { requirePermission } from "@/lib/requirePermission";
import { Permission } from "@/lib/permissions";
import type {
  ActualizarGastoFinancieroResponse,
  EliminarFinanzasResponse,
  ObtenerGastoFinancieroResponse,
} from "@/model/finanzas";
import { rpcErrorMessage, rpcStatus, validateUpdateGasto, validateUuid } from "../../cuentas-financieras/finanzasRouteUtils";
import { ApiError, apiErrorResponse } from "@/app/api/apiError";
import { ServiceError } from "@/app/api/serviceError";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { gastoService } from "../gastoService";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const authError = await requirePermission(Permission.FinanzasView);
  if (authError) return authError;

  const supabase = await createClient();

  const { id } = await params;
  const idError = validateUuid(id, "gastoId");
  if (idError) return Response.json({ data: null, error: idError } satisfies ObtenerGastoFinancieroResponse, { status: 400 });

  const { data: gasto, error, cause } = await gastoService.getById(supabase, id);
  if (!gasto) {
    return apiErrorResponse(cause ?? error, {
      context: "GET /api/gastos/[id]",
      fallback: "Error cargando gasto",
      notFoundMessage: "Gasto no encontrado",
      body: { data: null },
      extra: { gastoId: id },
    });
  }
  return Response.json({ data: gasto, error: null } satisfies ObtenerGastoFinancieroResponse, { status: 200 });
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const authError = await requirePermission(Permission.FinanzasEdit);
  if (authError) return authError;

  const supabase = await createClient();

  const { id } = await params;
  const idError = validateUuid(id, "gastoId");
  if (idError) return Response.json({ data: null, error: idError } satisfies ActualizarGastoFinancieroResponse, { status: 400 });
  const parsed = validateUpdateGasto(await req.json().catch(() => null));
  if (parsed.error || !parsed.value) {
    return Response.json({ data: null, error: parsed.error ?? "JSON inválido" } satisfies ActualizarGastoFinancieroResponse, { status: 400 });
  }

  const { data, error, cause } = await gastoService.update(supabase, id, parsed.value);
  if (!data) {
    const failure = cause ?? (error === ServiceError.Validation
      ? new ApiError(400, "Registrá un pago para asignar una cuenta al gasto.", "VALIDATION")
      : error);
    return apiErrorResponse(failure, {
      context: "PUT /api/gastos/[id]",
      fallback: "Error actualizando gasto",
      notFoundMessage: "Gasto no encontrado",
      body: { data: null },
      extra: { gastoId: id },
    });
  }

  await statsService.onDataChanged(supabase);

  return Response.json({ data, error: null } satisfies ActualizarGastoFinancieroResponse, { status: 200 });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const authError = await requirePermission(Permission.FinanzasEdit);
  if (authError) return authError;

  const supabase = await createClient();

  const { id } = await params;
  const idError = validateUuid(id, "gastoId");
  if (idError) return Response.json({ error: idError } satisfies EliminarFinanzasResponse, { status: 400 });

  const result = await gastoService.deleteById(supabase, id);
  if (result.error) {
    const cause = "cause" in result ? result.cause : null;
    const status = cause ? rpcStatus(cause) : 404;
    const message = status === 404
      ? "Gasto no encontrado"
      : status === 409
        ? rpcErrorMessage(cause, "Error eliminando gasto")
        : "Error eliminando gasto";
    return Response.json({ error: message } satisfies EliminarFinanzasResponse, { status });
  }
  await statsService.onDataChanged(supabase);
  return Response.json({ error: null } satisfies EliminarFinanzasResponse, { status: 200 });
}

