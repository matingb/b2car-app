import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";
import { detalleArregloService } from "@/app/api/arreglos/detalleArregloService";
import { syncArregloDescripcion } from "@/app/api/arreglos/arregloDescripcionService";
import { ServiceError } from "@/app/api/serviceError";

export type CreateDetalleArregloRequest = {
  descripcion: string;
  cantidad: number;
  valor: number;
};

export type DetalleArregloResponseRow = {
  id: string;
  arreglo_id: string;
  descripcion: string;
  cantidad: number;
  valor: number;
  created_at: string;
  updated_at: string;
};

export type CreateDetalleArregloResponse = {
  data: DetalleArregloResponseRow | null;
  error?: string | null;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id: arregloId } = await params;

  const body: CreateDetalleArregloRequest | null = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ data: null, error: "JSON inválido" } satisfies CreateDetalleArregloResponse, { status: 400 });
  }

  const descripcion = String(body.descripcion ?? "").trim();
  const cantidad = Number(body.cantidad);
  const valor = Number(body.valor);

  if (!arregloId) {
    return Response.json({ data: null, error: "Falta arreglo_id" } satisfies CreateDetalleArregloResponse, { status: 400 });
  }
  if (!descripcion) {
    return Response.json({ data: null, error: "Falta descripción" } satisfies CreateDetalleArregloResponse, { status: 400 });
  }
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return Response.json({ data: null, error: "Cantidad inválida" } satisfies CreateDetalleArregloResponse, { status: 400 });
  }
  if (!Number.isFinite(valor) || valor < 0) {
    return Response.json({ data: null, error: "Valor inválido" } satisfies CreateDetalleArregloResponse, { status: 400 });
  }

  const { data, error } = await detalleArregloService.create(supabase, {
    arreglo_id: arregloId,
    descripcion,
    cantidad,
    valor,
  });

  if (error || !data) {
    return Response.json(
      { data: null, error: "Error creando detalle del arreglo" } satisfies CreateDetalleArregloResponse,
      { status: 500 }
    );
  }

  const { error: syncError } = await syncArregloDescripcion(supabase, arregloId);
  if (syncError) {
    const status = syncError === ServiceError.NotFound ? 404 : 500;
    const message = "Error actualizando la descripción del arreglo";
    return Response.json({ data: null, error: message } satisfies CreateDetalleArregloResponse, { status });
  }

  return Response.json({ data, error: null } satisfies CreateDetalleArregloResponse, { status: 201 });
}

