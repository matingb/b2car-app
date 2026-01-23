import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { inventarioMockDb } from "@/app/api/inventario/inventarioMockDb";
import type { ProductoDetailDTO, StockDTO } from "@/model/dtos";
import type { MockProductoRow, MockStockRow } from "@/app/api/inventario/inventarioMockDb";
import type { GetProductoByIdResponse, UpdateProductoRequest, UpdateProductoResponse } from "../contracts";

function mapProducto(row: MockProductoRow): Omit<ProductoDetailDTO, "stocks"> {
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    marca: row.marca ?? null,
    modelo: row.modelo ?? null,
    descripcion: row.descripcion ?? null,
    precio_unitario: Number(row.precio_unitario) || 0,
    costo_unitario: Number(row.costo_unitario) || 0,
    proveedor: row.proveedor ?? null,
    categorias: Array.isArray(row.categorias) ? row.categorias : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapStock(row: MockStockRow): StockDTO {
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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return Response.json({ data: null, error: "Falta id" } satisfies GetProductoByIdResponse, { status: 400 });

  const producto = inventarioMockDb.getProductoById(id);
  if (!producto) {
    return Response.json({ data: null, error: "Producto no encontrado" } satisfies GetProductoByIdResponse, { status: 404 });
  }

  const stocks = inventarioMockDb.listStocksForProducto(id);

  return Response.json(
    { data: { ...mapProducto(producto), stocks: (stocks ?? []).map(mapStock) }, error: null } satisfies GetProductoByIdResponse,
    { status: 200 }
  );
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body: UpdateProductoRequest | null = await req.json().catch(() => null);
  if (!body) return Response.json({ data: null, error: "JSON inválido" } satisfies UpdateProductoResponse, { status: 400 });

  const patch: Partial<Omit<MockProductoRow, "id" | "tenantId" | "created_at" | "updated_at">> = {};
  if (body.codigo !== undefined) patch.codigo = String(body.codigo ?? "").trim();
  if (body.nombre !== undefined) patch.nombre = String(body.nombre ?? "").trim();
  if (body.marca !== undefined) patch.marca = body.marca ?? null;
  if (body.modelo !== undefined) patch.modelo = body.modelo ?? null;
  if (body.descripcion !== undefined) patch.descripcion = body.descripcion ?? null;
  if (body.precio_unitario !== undefined) patch.precio_unitario = body.precio_unitario;
  if (body.costo_unitario !== undefined) patch.costo_unitario = body.costo_unitario;
  if (body.proveedor !== undefined) patch.proveedor = body.proveedor ?? null;
  if (body.categorias !== undefined) patch.categorias = Array.isArray(body.categorias) ? body.categorias.filter(Boolean) : [];

  try {
    const updated = inventarioMockDb.updateProductoById(id, patch);
    if (!updated) {
      return Response.json({ data: null, error: "Producto no encontrado" } satisfies UpdateProductoResponse, { status: 404 });
    }
    const stocks = inventarioMockDb.listStocksForProducto(id);

    return Response.json(
      { data: { ...mapProducto(updated), stocks: (stocks ?? []).map(mapStock) }, error: null } satisfies UpdateProductoResponse,
      { status: 200 }
    );
  } catch (error: unknown) {
    logger.error("PUT /api/productos/[id] mock error:", error);
    return Response.json({ data: null, error: "Error actualizando producto" } satisfies UpdateProductoResponse, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return Response.json({ error: "Falta id" }, { status: 400 });

  try {
    const ok = inventarioMockDb.deleteProductoById(id);
    if (!ok) return Response.json({ error: "Producto no encontrado" }, { status: 404 });
    return Response.json({ error: null }, { status: 200 });
  } catch (error: unknown) {
    logger.error("DELETE /api/productos/[id] mock error:", error);
    return Response.json({ error: "Error eliminando producto" }, { status: 500 });
  }
}

