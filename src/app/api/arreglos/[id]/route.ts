import { Arreglo } from "@/model/types";
import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { arregloService } from "@/app/api/arreglos/arregloService";
import type {
  CreateArregloDetalleFormularioInput,
  UpdateArregloRequest,
} from "../arregloRequests";
import { ServiceError } from "../../serviceError";
import { ESTADOS_ARREGLO, EstadoArreglo } from "@/model/types";
import type { ArregloFormularioLineaValue } from "../arregloRequests";

export type DetalleArreglo = {
  id: string;
  arreglo_id: string;
  descripcion: string;
  cantidad: number;
  valor: number;
  created_at?: string;
  updated_at?: string;
};

export type AsignacionArregloProducto = {
  id: string;
  codigo: string;
  nombre: string;
  precio_unitario?: number;
  costo_unitario?: number;
  proveedor?: string | null;
  categorias?: string[];
};

export type AsignacionArregloLinea = {
  id: string;
  operacion_id: string;
  stock_id: string;
  cantidad: number;
  monto_unitario: number;
  delta_cantidad: number;
  created_at: string;
  producto?: AsignacionArregloProducto | null;
};

export type AsignacionArregloOperacion = {
  id: string;
  tipo: string;
  taller_id: string;
  created_at: string;
  lineas: AsignacionArregloLinea[];
};

export type ArregloDetalleData = {
  arreglo: Arreglo;
  detalles: DetalleArreglo[];
  asignaciones: AsignacionArregloOperacion[];
  detalle_formulario: DetalleArregloFormulario | null;
};

export type DetalleArregloFormulario = {
  id: string;
  arreglo_id: string;
  formulario_id: string | null;
  costo: number;
  metadata: ArregloFormularioLineaValue[];
  created_at?: string;
  updated_at?: string;
};

export type GetArregloByIdResponse = {
  data: ArregloDetalleData | null;
  error?: string | null;
};

export type UpdateArregloResponse = {
  data: Arreglo | null;
  error?: string | null;
};

// GET /api/arreglos/[id] -> obtener un arreglo + detalles (servicios) + asignaciones (repuestos)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "rpc_get_arreglo_detalle",
    { p_arreglo_id: id }
  );

  if (rpcError) {
    console.error("Error rpc_get_arreglo_detalle:", rpcError);
    const status = String((rpcError as unknown as { code?: unknown })?.code ?? "").includes("42501") ? 401 : 500;
    return Response.json(
      { data: null, error: "Error cargando arreglo" },
      { status }
    );
  }

  if (!rpcData) {
    return Response.json({ data: null, error: "Arreglo no encontrado" }, { status: 404 });
  }

  const rpc = rpcData as {
    arreglo?: unknown;
    detalles?: unknown;
    asignaciones?: unknown;
  };

  const arreglo = rpc.arreglo as Arreglo;
  const detalles = (Array.isArray(rpc.detalles) ? rpc.detalles : []) as DetalleArreglo[];
  const asignaciones = (Array.isArray(rpc.asignaciones) ? rpc.asignaciones : []) as AsignacionArregloOperacion[];

  const { data: detalleFormularioRows, error: detalleFormularioError } = await supabase
    .from("detalle_form_custom")
    .select("id, arreglo_id, formulario_id:config_id, costo, metadata, created_at, updated_at")
    .eq("arreglo_id", id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (detalleFormularioError) {
    return Response.json(
      { data: null, error: "Error cargando detalle de formulario" },
      { status: 500 }
    );
  }

  const detalleFormularioRaw = Array.isArray(detalleFormularioRows)
    ? detalleFormularioRows[0]
    : null;

  const detalleFormulario: DetalleArregloFormulario | null = detalleFormularioRaw
    ? {
      id: String(detalleFormularioRaw.id ?? ""),
      arreglo_id: String(detalleFormularioRaw.arreglo_id ?? ""),
      formulario_id:
        detalleFormularioRaw.formulario_id == null
          ? null
          : String(detalleFormularioRaw.formulario_id),
      costo: Number(detalleFormularioRaw.costo) || 0,
      metadata: Array.isArray(detalleFormularioRaw.metadata)
        ? (detalleFormularioRaw.metadata as ArregloFormularioLineaValue[])
        : [],
      created_at:
        detalleFormularioRaw.created_at == null
          ? undefined
          : String(detalleFormularioRaw.created_at),
      updated_at:
        detalleFormularioRaw.updated_at == null
          ? undefined
          : String(detalleFormularioRaw.updated_at),
    }
    : null;

  const payload: ArregloDetalleData = {
    arreglo: arreglo as Arreglo,
    detalles,
    asignaciones,
    detalle_formulario: detalleFormulario,
  };

  return Response.json({ data: payload, error: null });
}

// PUT /api/arreglos/[id] -> actualizar arreglo (edición parcial)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const payload:
    | (UpdateArregloRequest & {
      estado?: unknown;
      detalle_formulario?: CreateArregloDetalleFormularioInput;
    })
    | null = await req.json().catch(() => null);
  if (!payload) return Response.json({ error: "JSON inválido" }, { status: 400 });

  const { detalle_formulario, ...arregloPatch } = payload;

  if (arregloPatch.estado !== undefined) {
    const estado = String(arregloPatch.estado ?? "").trim().toUpperCase();
    if (!(ESTADOS_ARREGLO as string[]).includes(estado)) {
      return Response.json({ data: null, error: "Estado de arreglo inválido" }, { status: 400 });
    }
    arregloPatch.estado = estado as EstadoArreglo;
  }

  const patchEntries = Object.entries(arregloPatch).filter(([, value]) => value !== undefined);

  let updatedArreglo: Arreglo | null = null;
  if (patchEntries.length > 0) {
    const { data, error } = await arregloService.updateById(
      supabase,
      id,
      arregloPatch
    );

    if (error) {
      const status = error === ServiceError.NotFound ? 404 : 500;
      const message = status === 404 ? "Arreglo no encontrado" : "Error actualizando arreglo";
      return Response.json({ data: null, error: message }, { status });
    }

    updatedArreglo = data;
  } else {
    const { data: currentArreglo, error: currentError } = await arregloService.getByIdWithVehiculo(
      supabase,
      id
    );

    if (currentError) {
      const status = currentError === ServiceError.NotFound ? 404 : 500;
      const message = status === 404 ? "Arreglo no encontrado" : "Error actualizando arreglo";
      return Response.json({ data: null, error: message }, { status });
    }

    updatedArreglo = currentArreglo;
  }

  if (detalle_formulario) {
    const hasConfigId =
      detalle_formulario.formulario_id !== undefined ||
      detalle_formulario.config_id !== undefined;
    const configId = hasConfigId
      ? String(detalle_formulario.formulario_id ?? detalle_formulario.config_id ?? "").trim() || null
      : undefined;
    const costo = Number(detalle_formulario.costo);
    const metadata = Array.isArray(detalle_formulario.metadata)
      ? detalle_formulario.metadata
      : [];

    if (!Number.isFinite(costo) || costo < 0) {
      return Response.json(
        { data: null, error: "Costo inválido en detalle de formulario" },
        { status: 400 }
      );
    }

    const { data: detalleRows, error: detalleLookupError } = await supabase
      .from("detalle_form_custom")
      .select("id")
      .eq("arreglo_id", id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (detalleLookupError) {
      return Response.json(
        { data: null, error: "Error cargando detalle de formulario" },
        { status: 500 }
      );
    }

    const detalleId = Array.isArray(detalleRows)
      ? String(detalleRows[0]?.id ?? "").trim()
      : "";

    if (detalleId) {
      const updatePayload: {
        costo: number;
        metadata: ArregloFormularioLineaValue[];
        config_id?: string | null;
      } = {
        costo,
        metadata,
      };
      if (hasConfigId) {
        updatePayload.config_id = configId;
      }

      const { error: detalleUpdateError } = await supabase
        .from("detalle_form_custom")
        .update(updatePayload)
        .eq("id", detalleId);

      if (detalleUpdateError) {
        return Response.json(
          { data: null, error: "Error actualizando detalle del formulario" },
          { status: 500 }
        );
      }
    } else {
      const { error: detalleInsertError } = await supabase
        .from("detalle_form_custom")
        .insert([
          {
            arreglo_id: id,
            config_id: configId ?? null,
            costo,
            metadata,
          },
        ]);

      if (detalleInsertError) {
        return Response.json(
          { data: null, error: "Error guardando detalle del formulario" },
          { status: 500 }
        );
      }
    }
  }

  await statsService.onDataChanged(supabase);
  return Response.json({ data: updatedArreglo, error: null }, { status: 200 });
}

// DELETE /api/arreglos/[id] -> eliminar arreglo
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  if (!id)
    return Response.json({ error: "ID de arreglo no proporcionado" }, { status: 400 });

  const { error } = await arregloService.deleteById(supabase, id);

  if (error) {
    const status = error === ServiceError.NotFound ? 404 : 500;
    const message = status === 404 ? "Arreglo no encontrado" : "Error eliminando arreglo";
    return Response.json({ error: message }, { status });
  }

  await statsService.onDataChanged(supabase);
  return Response.json({ error: null }, { status: 200 });
}
