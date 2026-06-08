import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import type { EmpleadoDTO } from "@/model/dtos";
import type {
  CreateEmpleadoRequest,
  CreateEmpleadoResponse,
  GetEmpleadosResponse,
} from "./contracts";
import { createClient } from "@/supabase/server";
import { empleadosService, type EmpleadoRow } from "./empleadosService";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";

function mapEmpleado(row: EmpleadoRow): EmpleadoDTO {
  return {
    id: row.id,
    taller_id: row.taller_id,
    nombre: row.nombre,
    apellido: row.apellido,
    dni: row.dni,
    email: row.email ?? null,
    telefono: row.telefono ?? null,
    cumpleanos: row.cumpleanos ?? null,
    salario: row.salario === null || row.salario === undefined ? null : Number(row.salario),
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
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json(
      { data: null, error: "Unauthorized" } satisfies GetEmpleadosResponse,
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

  return Response.json(
    { data: (data ?? []).map(mapEmpleado), error: null } satisfies GetEmpleadosResponse,
    { status: 200 }
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json(
      { data: null, error: "Unauthorized" } satisfies CreateEmpleadoResponse,
      { status: 401 }
    );
  }

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

  const insertPayload = {
    taller_id: body.taller_id.trim(),
    nombre: body.nombre.trim(),
    apellido: body.apellido.trim(),
    dni: body.dni.trim(),
    email: body.email?.trim() || null,
    telefono: body.telefono?.trim() || null,
    cumpleanos: body.cumpleanos || null,
    salario: body.salario ?? null,
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
    await statsService.onDataChanged(supabase, created.tenant_id);
    return Response.json(
      { data: mapEmpleado(created), error: null } satisfies CreateEmpleadoResponse,
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
