import { createClient } from "@/supabase/server";
import { NextRequest } from "next/server";
import type { ClienteMovimientoCuenta } from "@/model/types";
import { clienteFinanzasService } from "../../clienteFinanzasService";
import { requirePermission } from "@/lib/requirePermission";
import { Permission } from "@/lib/permissions";
import { ServiceError } from "@/app/api/serviceError";
import { isValidUuid } from "@/lib/uuid";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { logger } from "@/lib/logger";

export type GetClienteCuentaCorrienteResponse = {
  data: ClienteMovimientoCuenta[] | null;
  error?: string | null;
};

export type CreateMovimientoCuentaCorrienteClienteResponse = {
  data: { id: string; ok: boolean } | null;
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requirePermission(Permission.ClientesFinanzasEdit);
  if (authError) return authError;

  const { id } = await params;
  if (!isValidUuid(id)) {
    return Response.json(
      {
        data: null,
        error: "ID de cliente inválido",
      } satisfies CreateMovimientoCuentaCorrienteClienteResponse,
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json(
      {
        data: null,
        error: "JSON inválido",
      } satisfies CreateMovimientoCuentaCorrienteClienteResponse,
      { status: 400 }
    );
  }

  const rawPagos = Array.isArray(body.pagos) ? body.pagos : null;
  let parsedPagos:
    | Array<{
        cuentaId: string;
        importe: number;
        fecha?: string;
        descripcion?: string;
        idempotencyKey?: string;
      }>
    | undefined = undefined;
  let cuentaId: string | undefined = undefined;
  let importe: number | undefined = undefined;

  if (rawPagos && rawPagos.length > 0) {
    parsedPagos = [];
    for (const p of rawPagos) {
      const cId = p.cuenta_id ?? p.cuentaId;
      if (!cId || !isValidUuid(cId)) {
        return Response.json(
          {
            data: null,
            error: "Seleccioná una cuenta financiera válida para cada movimiento",
          } satisfies CreateMovimientoCuentaCorrienteClienteResponse,
          { status: 400 }
        );
      }
      const imp = Number(p.importe);
      if (!Number.isFinite(imp) || imp === 0) {
        return Response.json(
          {
            data: null,
            error: "El importe de cada movimiento no puede ser cero",
          } satisfies CreateMovimientoCuentaCorrienteClienteResponse,
          { status: 400 }
        );
      }
      const idem = p.idempotency_key ?? p.idempotencyKey;
      if (idem && !isValidUuid(idem)) {
        return Response.json(
          {
            data: null,
            error: "idempotency_key inválida",
          } satisfies CreateMovimientoCuentaCorrienteClienteResponse,
          { status: 400 }
        );
      }
      parsedPagos.push({
        cuentaId: cId,
        importe: imp,
        fecha: p.fecha,
        descripcion: p.descripcion,
        idempotencyKey: idem,
      });
    }
  } else {
    cuentaId = body.cuenta_id ?? body.cuentaId;
    if (!cuentaId || !isValidUuid(cuentaId)) {
      return Response.json(
        {
          data: null,
          error: "Seleccioná una cuenta financiera válida",
        } satisfies CreateMovimientoCuentaCorrienteClienteResponse,
        { status: 400 }
      );
    }

    importe = Number(body.importe);
    if (!Number.isFinite(importe) || importe === 0) {
      return Response.json(
        {
          data: null,
          error: "El importe no puede ser cero",
        } satisfies CreateMovimientoCuentaCorrienteClienteResponse,
        { status: 400 }
      );
    }
  }

  const idempotencyKey = body.idempotency_key ?? body.idempotencyKey;
  if (idempotencyKey && !isValidUuid(idempotencyKey)) {
    return Response.json(
      {
        data: null,
        error: "idempotency_key inválida",
      } satisfies CreateMovimientoCuentaCorrienteClienteResponse,
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data, error } = await clienteFinanzasService.createMovimientoDirecto(
    supabase,
    id,
    {
      cuentaId,
      importe,
      fecha: body.fecha,
      descripcion: body.descripcion,
      idempotencyKey,
      observaciones: body.observaciones,
      tallerId: body.taller_id ?? body.tallerId,
      pagos: parsedPagos,
    }
  );

  if (error) {
    logger.error("POST /api/clientes/[id]/cuenta-corriente - error:", error);
    const status =
      error === ServiceError.NotFound
        ? 404
        : error === ServiceError.Validation
          ? 400
          : 500;
    return Response.json(
      {
        data: null,
        error: error.toString(),
      } satisfies CreateMovimientoCuentaCorrienteClienteResponse,
      { status }
    );
  }

  await statsService.onDataChanged(supabase);

  return Response.json(
    {
      data: { id: data!, ok: true },
      error: null,
    } satisfies CreateMovimientoCuentaCorrienteClienteResponse,
    { status: 201 }
  );
}
