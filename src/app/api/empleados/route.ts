import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import type { EmpleadoDTO } from "@/model/dtos";
import type {
  CreateEmpleadoRequest,
  CreateEmpleadoResponse,
  GetEmpleadosResponse,
} from "./contracts";
import { createClient } from "@/supabase/server";
import { requirePermission } from "@/lib/requirePermission";
import { hasUserPermission } from "@/lib/permissions.server";
import { Permission } from "@/lib/permissions";
import { empleadosService, type EmpleadoRow } from "./empleadosService";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";

function mapEmpleado(row: EmpleadoRow, options?: { hideSalaries?: boolean; valorHora?: number | null }): EmpleadoDTO {
  return {
    id: row.id,
    taller_id: row.taller_id,
    nombre: row.nombre,
    apellido: row.apellido,
    dni: row.dni,
    email: row.email ?? null,
    telefono: row.telefono ?? null,
    cumpleanos: row.cumpleanos ?? null,
    salario: options?.hideSalaries
      ? null
      : row.salario === null || row.salario === undefined
        ? null
        : Number(row.salario),
    valor_hora: options?.hideSalaries
      ? null
      : options?.valorHora ?? row.valor_hora ?? null,
    fecha_ingreso: row.fecha_ingreso ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims) {
    return Response.json(
      { data: [], error: "Unauthorized" } satisfies GetEmpleadosResponse,
      { status: 401 }
    );
  }

  const tallerId = req.nextUrl.searchParams.get("tallerId") ?? undefined;

  const { data, error } = await empleadosService.list(supabase, { tallerId });
  if (error) {
    return Response.json(
      { data: [], error: "Error listando empleados" } satisfies GetEmpleadosResponse,
      { status: 500 }
    );
  }

  const hasEmpleadosView = await hasUserPermission(supabase, Permission.EmpleadosView);
  const hideSalaries = !hasEmpleadosView;
  const hourlyRates = hasEmpleadosView
    ? await empleadosService.listHourlyRates(supabase, tallerId)
    : { data: [], error: null };
  if (hourlyRates.error) {
    return Response.json(
      { data: [], error: "Error listando valores hora" } satisfies GetEmpleadosResponse,
      { status: 500 }
    );
  }
  const ratesByEmployeeId = new Map(hourlyRates.data.map((row) => [row.empleado_id, row.valor_hora]));

  return Response.json(
    { data: (data ?? []).map((row) => mapEmpleado(row, { hideSalaries, valorHora: ratesByEmployeeId.get(row.id) ?? null })), error: null } satisfies GetEmpleadosResponse,
    { status: 200 }
  );
}

export async function POST(req: Request) {
  const authError = await requirePermission(Permission.EmpleadosEdit);
  if (authError) return authError;

  const supabase = await createClient();

  const body: CreateEmpleadoRequest | null = await req.json().catch(() => null);
  if (!body) {
    return Response.json(
      { data: null, error: "JSON inválido" } satisfies CreateEmpleadoResponse,
      { status: 400 }
    );
  }

  if (!body.taller_id?.trim()) {
    return Response.json(
      { data: null, error: "Falta taller_id" } satisfies CreateEmpleadoResponse,
      { status: 400 }
    );
  }
  if (!body.nombre?.trim()) {
    return Response.json(
      { data: null, error: "Falta nombre" } satisfies CreateEmpleadoResponse,
      { status: 400 }
    );
  }
  if (!body.apellido?.trim()) {
    return Response.json(
      { data: null, error: "Falta apellido" } satisfies CreateEmpleadoResponse,
      { status: 400 }
    );
  }
  if (!body.dni?.trim()) {
    return Response.json(
      { data: null, error: "Falta dni" } satisfies CreateEmpleadoResponse,
      { status: 400 }
    );
  }
  if (body.salario !== undefined && body.salario !== null) {
    if (typeof body.salario !== "number" || Number.isNaN(body.salario) || body.salario < 0) {
      return Response.json(
        { data: null, error: "El salario debe ser un número >= 0" } satisfies CreateEmpleadoResponse,
        { status: 400 }
      );
    }
    if (body.salario > 0 && !body.salario_vigente_desde?.trim() && !body.fecha_ingreso?.trim()) {
      return Response.json(
        { data: null, error: "Falta salario_vigente_desde cuando se especifica salario" } satisfies CreateEmpleadoResponse,
        { status: 400 }
      );
    }
  }
  if (body.valor_hora !== undefined && body.valor_hora !== null) {
    const rate = body.valor_hora;
    const cents = rate * 100;
    if (
      typeof rate !== "number" || !Number.isFinite(rate) || rate < 0 ||
      rate > 9_999_999_999.99 || Math.abs(cents - Math.round(cents)) > 1e-7
    ) {
      return Response.json(
        { data: null, error: "El valor hora debe ser un nÃºmero >= 0 con hasta dos decimales" } satisfies CreateEmpleadoResponse,
        { status: 400 }
      );
    }
  }
  if (body.cumpleanos && !isValidIsoDate(body.cumpleanos)) {
    return Response.json(
      { data: null, error: "cumpleanos debe ser una fecha válida (YYYY-MM-DD)" } satisfies CreateEmpleadoResponse,
      { status: 400 }
    );
  }
  if (body.fecha_ingreso && !isValidIsoDate(body.fecha_ingreso)) {
    return Response.json(
      { data: null, error: "fecha_ingreso debe ser una fecha válida (YYYY-MM-DD)" } satisfies CreateEmpleadoResponse,
      { status: 400 }
    );
  }
  if (body.salario_vigente_desde && !isValidIsoDate(body.salario_vigente_desde)) {
    return Response.json(
      { data: null, error: "salario_vigente_desde debe ser una fecha válida (YYYY-MM-DD)" } satisfies CreateEmpleadoResponse,
      { status: 400 }
    );
  }

  const insertPayload = {
    taller_id: body.taller_id.trim(),
    nombre: body.nombre.trim(),
    apellido: body.apellido.trim(),
    dni: body.dni.trim(),
    email: body.email?.trim() || null,
    telefono: body.telefono?.trim() || null,
    cumpleanos: body.cumpleanos || null,
    salario: body.salario ?? null,
    valor_hora: body.valor_hora ?? null,
    fecha_ingreso: body.fecha_ingreso || null,
  };

  try {
    const { data: created, error } = await empleadosService.create(supabase, insertPayload);
    if (error || !created) {
      return Response.json(
        { data: null, error: "Error creando empleado" } satisfies CreateEmpleadoResponse,
        { status: 500 }
      );
    }

    const vigenteDesdeMes = body.salario_vigente_desde
      ? `${body.salario_vigente_desde.slice(0, 7)}-01`
      : body.fecha_ingreso && body.salario !== undefined && body.salario !== null && body.salario > 0
        ? `${body.fecha_ingreso.slice(0, 7)}-01`
        : null;

    if (vigenteDesdeMes && body.salario !== undefined && body.salario !== null) {
      const { error: salarioError } = await empleadosService.recordSalarioChange(
        supabase,
        created.id,
        created.taller_id,
        body.salario,
        vigenteDesdeMes
      );
      if (salarioError) {
        logger.error("Error guardando historial salarial:", salarioError);
        return Response.json(
          { data: null, error: "Error guardando historial salarial" } satisfies CreateEmpleadoResponse,
          { status: 500 }
        );
      }
    }

    await statsService.onDataChanged(supabase, created.tenant_id);
    const hasEmpleadosView = await hasUserPermission(supabase, Permission.EmpleadosView);
    return Response.json(
      { data: mapEmpleado({ ...created, valor_hora: body.valor_hora ?? null }, { hideSalaries: !hasEmpleadosView }), error: null } satisfies CreateEmpleadoResponse,
      { status: 201 }
    );
  } catch (error: unknown) {
    logger.error("POST /api/empleados error:", error);
    return Response.json(
      { data: null, error: "Error creando empleado" } satisfies CreateEmpleadoResponse,
      { status: 500 }
    );
  }
}
