import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import type { EmpleadoDTO } from "@/model/dtos";
import type {
  GetEmpleadoByIdResponse,
  UpdateEmpleadoRequest,
  UpdateEmpleadoResponse,
} from "../contracts";
import { createClient } from "@/supabase/server";
import { empleadosService, type EmpleadoRow } from "../empleadosService";
import { ServiceError } from "@/app/api/serviceError";
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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json(
      { data: null, error: "Unauthorized" } satisfies GetEmpleadoByIdResponse,
      { status: 401 }
    );
  }

  const { id } = await params;
  if (!id) {
    return Response.json(
      { data: null, error: "Falta id" } satisfies GetEmpleadoByIdResponse,
      { status: 400 }
    );
  }

  const { data, error } = await empleadosService.getById(supabase, id);
  if (error === ServiceError.NotFound || !data) {
    return Response.json(
      { data: null, error: "Empleado no encontrado" } satisfies GetEmpleadoByIdResponse,
      { status: 404 }
    );
  }

  return Response.json(
    { data: mapEmpleado(data), error: null } satisfies GetEmpleadoByIdResponse,
    { status: 200 }
  );
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json(
      { data: null, error: "Unauthorized" } satisfies UpdateEmpleadoResponse,
      { status: 401 }
    );
  }

  const { id } = await params;
  if (!id) {
    return Response.json(
      { data: null, error: "Falta id" } satisfies UpdateEmpleadoResponse,
      { status: 400 }
    );
  }

  const body: UpdateEmpleadoRequest | null = await req.json().catch(() => null);
  if (!body) {
    return Response.json(
      { data: null, error: "JSON inválido" } satisfies UpdateEmpleadoResponse,
      { status: 400 }
    );
  }

  if (body.taller_id !== undefined && !String(body.taller_id ?? "").trim()) {
    return Response.json(
      { data: null, error: "Falta taller_id" } satisfies UpdateEmpleadoResponse,
      { status: 400 }
    );
  }
  if (body.nombre !== undefined && !String(body.nombre ?? "").trim()) {
    return Response.json(
      { data: null, error: "Falta nombre" } satisfies UpdateEmpleadoResponse,
      { status: 400 }
    );
  }
  if (body.apellido !== undefined && !String(body.apellido ?? "").trim()) {
    return Response.json(
      { data: null, error: "Falta apellido" } satisfies UpdateEmpleadoResponse,
      { status: 400 }
    );
  }
  if (body.dni !== undefined && !String(body.dni ?? "").trim()) {
    return Response.json(
      { data: null, error: "Falta dni" } satisfies UpdateEmpleadoResponse,
      { status: 400 }
    );
  }
  if (body.salario !== undefined && body.salario !== null) {
    if (typeof body.salario !== "number" || Number.isNaN(body.salario) || body.salario < 0) {
      return Response.json(
        { data: null, error: "El salario debe ser un número >= 0" } satisfies UpdateEmpleadoResponse,
        { status: 400 }
      );
    }
  }
  if (body.salario_vigente_desde !== undefined && body.salario_vigente_desde !== null) {
    if (!isValidIsoDate(body.salario_vigente_desde)) {
      return Response.json(
        { data: null, error: "salario_vigente_desde debe ser una fecha válida (YYYY-MM-DD)" } satisfies UpdateEmpleadoResponse,
        { status: 400 }
      );
    }
  }
  if (body.cumpleanos !== undefined && body.cumpleanos !== null && !isValidIsoDate(body.cumpleanos)) {
    return Response.json(
      { data: null, error: "cumpleanos debe ser una fecha válida (YYYY-MM-DD)" } satisfies UpdateEmpleadoResponse,
      { status: 400 }
    );
  }
  if (body.fecha_ingreso !== undefined && body.fecha_ingreso !== null && !isValidIsoDate(body.fecha_ingreso)) {
    return Response.json(
      { data: null, error: "fecha_ingreso debe ser una fecha válida (YYYY-MM-DD)" } satisfies UpdateEmpleadoResponse,
      { status: 400 }
    );
  }

  const hasSalarioHistoryChange =
    !!body.salario_vigente_desde && body.salario !== undefined && body.salario !== null;

  const patch: Partial<Omit<EmpleadoRow, "id" | "tenant_id" | "created_at" | "updated_at">> = {};
  if (body.taller_id !== undefined) patch.taller_id = String(body.taller_id ?? "").trim();
  if (body.nombre !== undefined) patch.nombre = String(body.nombre ?? "").trim();
  if (body.apellido !== undefined) patch.apellido = String(body.apellido ?? "").trim();
  if (body.dni !== undefined) patch.dni = String(body.dni ?? "").trim();
  if (body.email !== undefined) patch.email = body.email?.trim() || null;
  if (body.telefono !== undefined) patch.telefono = body.telefono?.trim() || null;
  if (body.cumpleanos !== undefined) patch.cumpleanos = body.cumpleanos || null;
  if (body.salario !== undefined && !hasSalarioHistoryChange) patch.salario = body.salario ?? null;
  if (body.fecha_ingreso !== undefined) patch.fecha_ingreso = body.fecha_ingreso || null;

  try {
    const { data: currentEmpleado, error: currentEmpleadoError } =
      await empleadosService.getById(supabase, id);
    if (currentEmpleadoError === ServiceError.NotFound || !currentEmpleado) {
      return Response.json(
        { data: null, error: "Empleado no encontrado" } satisfies UpdateEmpleadoResponse,
        { status: 404 }
      );
    }
    if (currentEmpleadoError) {
      return Response.json(
        { data: null, error: "Error actualizando empleado" } satisfies UpdateEmpleadoResponse,
        { status: 500 }
      );
    }

    const hasEmpleadoPatch = Object.keys(patch).length > 0;
    const { data: empleadoActualizado, error } = hasEmpleadoPatch
      ? await empleadosService.updateById(supabase, id, patch)
      : { data: currentEmpleado, error: null };
    let updated = empleadoActualizado;
    if (error === ServiceError.NotFound || !updated) {
      return Response.json(
        { data: null, error: "Empleado no encontrado" } satisfies UpdateEmpleadoResponse,
        { status: 404 }
      );
    }
    if (error) {
      return Response.json(
        { data: null, error: "Error actualizando empleado" } satisfies UpdateEmpleadoResponse,
        { status: 500 }
      );
    }

    if (hasSalarioHistoryChange) {
      const vigenteDesdeMes = `${body.salario_vigente_desde!.slice(0, 7)}-01`;
      const { error: salarioError } = await empleadosService.recordSalarioChange(
        supabase,
        updated.id,
        updated.taller_id,
        body.salario!,
        vigenteDesdeMes
      );
      if (salarioError) {
        logger.error("Error guardando historial salarial:", salarioError);
        return Response.json(
          { data: null, error: "Error guardando historial salarial" } satisfies UpdateEmpleadoResponse,
          { status: 500 }
        );
      }

      const { data: latestSalario, error: latestSalarioError } =
        await empleadosService.getLatestSalario(supabase, updated.id);
      if (latestSalarioError || !latestSalario) {
        logger.error("Error calculando salario actual:", latestSalarioError);
        return Response.json(
          { data: null, error: "Error calculando salario actual" } satisfies UpdateEmpleadoResponse,
          { status: 500 }
        );
      }

      const { data: updatedWithLatestSalario, error: salarioActualError } =
        await empleadosService.updateById(supabase, updated.id, {
          salario: Number(latestSalario.salario),
        });
      if (salarioActualError || !updatedWithLatestSalario) {
        logger.error("Error actualizando salario actual:", salarioActualError);
        return Response.json(
          { data: null, error: "Error actualizando salario actual" } satisfies UpdateEmpleadoResponse,
          { status: 500 }
        );
      }

      updated = updatedWithLatestSalario;
    }

    await statsService.onDataChanged(
      supabase,
      [currentEmpleado.tenant_id, updated.tenant_id]
    );

    return Response.json(
      { data: mapEmpleado(updated), error: null } satisfies UpdateEmpleadoResponse,
      { status: 200 }
    );
  } catch (error: unknown) {
    logger.error("PUT /api/empleados/[id] error:", error);
    return Response.json(
      { data: null, error: "Error actualizando empleado" } satisfies UpdateEmpleadoResponse,
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return Response.json({ error: "Falta id" }, { status: 400 });

  try {
    const { data: currentEmpleado, error: currentEmpleadoError } =
      await empleadosService.getById(supabase, id);
    if (currentEmpleadoError === ServiceError.NotFound || !currentEmpleado) {
      return Response.json({ error: "Empleado no encontrado" }, { status: 404 });
    }
    if (currentEmpleadoError) {
      return Response.json({ error: "Error eliminando empleado" }, { status: 500 });
    }

    const { error } = await empleadosService.deleteById(supabase, id);
    if (error === ServiceError.NotFound) {
      return Response.json({ error: "Empleado no encontrado" }, { status: 404 });
    }
    if (error) {
      return Response.json({ error: "Error eliminando empleado" }, { status: 500 });
    }
    await statsService.onDataChanged(supabase, currentEmpleado.tenant_id);
    return Response.json({ error: null }, { status: 200 });
  } catch (error: unknown) {
    logger.error("DELETE /api/empleados/[id] error:", error);
    return Response.json({ error: "Error eliminando empleado" }, { status: 500 });
  }
}
