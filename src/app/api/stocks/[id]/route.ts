import type { NextRequest } from "next/server";
import type { StockDTO } from "@/model/dtos";
import type { GetStockByIdResponse, UpdateStockRequest, UpdateStockResponse } from "../contracts";
import { createClient } from "@/supabase/server";
import { stocksService, type StockItemRow, type StockRow } from "../stocksService";
import type { ProductoRow } from "../../productos/productosService";
import { ServiceError } from "@/app/api/serviceError";

function mapStockRow(row: StockRow): StockDTO {
  return {
    id: row.id,
    tallerId: row.taller_id,
    productoId: row.producto_id,
    cantidad: Number(row.cantidad) || 0,
    stock_minimo: Number(row.stock_minimo) || 0,
    stock_maximo: Number(row.stock_maximo) || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

type ProductoJoinRow = ProductoRow & { provedor?: string | null };

function mapProducto(row: ProductoJoinRow | null) {
  if (!row) return null;
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    marca: row.marca ?? null,
    modelo: row.modelo ?? null,
    descripcion: row.descripcion ?? null,
    precio_unitario: Number(row.precio_unitario) || 0,
    costo_unitario: Number(row.costo_unitario) || 0,
    proveedor: row.proveedor ?? row.provedor ?? null,
    categorias: Array.isArray(row.categorias) ? row.categorias : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies GetStockByIdResponse, { status: 401 });
  }

  const { id } = await params;
  if (!id) return Response.json({ data: null, error: "Falta id" } satisfies GetStockByIdResponse, { status: 400 });

  const { data, error } = await stocksService.getById(supabase, id);
  if (error === ServiceError.NotFound || !data) {
    return Response.json({ data: null, error: "Stock no encontrado" } satisfies GetStockByIdResponse, { status: 404 });
  }

  return Response.json(
    { data: { ...mapStockRow(data as StockItemRow), producto: mapProducto((data as StockItemRow).productos) }, error: null } satisfies GetStockByIdResponse,
    { status: 200 }
  );
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies UpdateStockResponse, { status: 401 });
  }

  const { id } = await params;
  const body: UpdateStockRequest | null = await req.json().catch(() => null);
  if (!body) return Response.json({ data: null, error: "JSON inválido" } satisfies UpdateStockResponse, { status: 400 });

  const patch: Partial<Pick<StockRow, "cantidad" | "stock_minimo" | "stock_maximo">> = {};
  if (body.cantidad !== undefined) patch.cantidad = body.cantidad;
  if (body.stock_minimo !== undefined) patch.stock_minimo = body.stock_minimo;
  if (body.stock_maximo !== undefined) patch.stock_maximo = body.stock_maximo;

  const { data: updated, error } = await stocksService.updateById(supabase, id, patch);
  if (error === ServiceError.NotFound || !updated) {
    return Response.json({ data: null, error: "Stock no encontrado" } satisfies UpdateStockResponse, { status: 404 });
  }
  return Response.json({ data: mapStockRow(updated), error: null } satisfies UpdateStockResponse, { status: 200 });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return Response.json({ error: "Falta id" }, { status: 400 });

  const { error } = await stocksService.deleteById(supabase, id);
  if (error === ServiceError.NotFound) return Response.json({ error: "Stock no encontrado" }, { status: 404 });
  if (error) return Response.json({ error: "Error eliminando stock" }, { status: 500 });
  return Response.json({ error: null }, { status: 200 });
}

