import type { NextRequest } from "next/server";
import { inventarioMockDb } from "@/app/api/inventario/inventarioMockDb";
import type { StockDTO } from "@/model/dtos";
import type { GetStockByIdResponse, UpdateStockRequest, UpdateStockResponse } from "../contracts";

function mapStockRow(row: any): StockDTO {
  return {
    id: row.id,
    tallerId: row.tallerId,
    productoId: row.productoId,
    cantidad: Number(row.cantidad) || 0,
    stock_minimo: Number(row.stock_minimo) || 0,
    stock_maximo: Number(row.stock_maximo) || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapProducto(row: any) {
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
    proveedor: row.provedor ?? row.proveedor ?? null,
    categorias: Array.isArray(row.categorias) ? row.categorias : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return Response.json({ data: null, error: "Falta id" } satisfies GetStockByIdResponse, { status: 400 });

  const data = inventarioMockDb.getStockById(id);
  if (!data) return Response.json({ data: null, error: "Stock no encontrado" } satisfies GetStockByIdResponse, { status: 404 });

  return Response.json(
    { data: { ...mapStockRow(data), producto: mapProducto(inventarioMockDb.getProductoById(data.productoId)) }, error: null } satisfies GetStockByIdResponse,
    { status: 200 }
  );
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body: UpdateStockRequest | null = await req.json().catch(() => null);
  if (!body) return Response.json({ data: null, error: "JSON inválido" } satisfies UpdateStockResponse, { status: 400 });

  const patch: any = {};
  if (body.cantidad !== undefined) patch.cantidad = body.cantidad;
  if (body.stock_minimo !== undefined) patch.stock_minimo = body.stock_minimo;
  if (body.stock_maximo !== undefined) patch.stock_maximo = body.stock_maximo;

  const updated = inventarioMockDb.updateStockById(id, patch);
  if (!updated) return Response.json({ data: null, error: "Stock no encontrado" } satisfies UpdateStockResponse, { status: 404 });
  return Response.json({ data: mapStockRow(updated), error: null } satisfies UpdateStockResponse, { status: 200 });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return Response.json({ error: "Falta id" }, { status: 400 });

  const ok = inventarioMockDb.deleteStockById(id);
  if (!ok) return Response.json({ error: "Stock no encontrado" }, { status: 404 });
  return Response.json({ error: null }, { status: 200 });
}

