import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";
import { ServiceError } from "../../serviceError";
import type { UpdateArregloRequest } from "../arregloRequests";
import {
  arregloCompletoService,
  type DetalleArreglo,
  type AsignacionArregloProducto,
  type AsignacionArregloLinea,
  type AsignacionArregloOperacion,
  type DetalleArregloFormulario,
  type ArregloDetalleData,
  type GetArregloByIdResponse,
  type UpdateArregloResponse,
} from "../arregloCompletoService";
import { arregloMutationService } from "../arregloMutationService";

import { Permission } from "@/lib/permissions";
import { hasUserPermission } from "@/lib/permissions.server";
import { mapArreglo, mapArregloDetalleCompleto } from "../arregloMapper";

export type {
  DetalleArreglo,
  AsignacionArregloProducto,
  AsignacionArregloLinea,
  AsignacionArregloOperacion,
  DetalleArregloFormulario,
  ArregloDetalleData,
  GetArregloByIdResponse,
  UpdateArregloResponse,
};

// GET /api/arreglos/[id] -> obtener un arreglo + detalles (servicios) + asignaciones (repuestos)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies GetArregloByIdResponse, { status: 401 });
  }

  const { id } = await params;

  const { data, error } = await arregloCompletoService.getArregloDetalleCompleto(supabase, id);

  if (error || !data) {
    const status = error === ServiceError.NotFound || !data ? 404 : 500;
    const message = status === 404 ? "Arreglo no encontrado" : "Error cargando arreglo";
    return Response.json({ data: null, error: message } satisfies GetArregloByIdResponse, { status });
  }

  const hasPreciosView = await hasUserPermission(supabase, Permission.ArreglosPreciosView);
  const mappedData = mapArregloDetalleCompleto(data, { hidePrices: !hasPreciosView });

  return Response.json({ data: mappedData, error: null } satisfies GetArregloByIdResponse);
}

// PUT /api/arreglos/[id] -> actualizar arreglo (edición parcial)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const payload: UpdateArregloRequest | null = await req.json().catch(() => null);
  if (!payload) return Response.json({ error: "JSON inválido" }, { status: 400 });

  const result = await arregloMutationService.updateArregloCompleto(supabase, id, payload);

  const hasPreciosView = await hasUserPermission(supabase, Permission.ArreglosPreciosView);
  const mappedData = result.data ? mapArreglo(result.data, { hidePrices: !hasPreciosView }) : null;

  return Response.json(
    { data: mappedData, error: result.error },
    { status: result.status }
  );
}

// DELETE /api/arreglos/[id] -> eliminar arreglo
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const result = await arregloMutationService.deleteArregloCompleto(supabase, id);

  return Response.json(
    { error: result.error },
    { status: result.status }
  );
}
