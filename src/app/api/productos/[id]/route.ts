import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import type { ProductoDetailDTO, StockDTO } from "@/model/dtos";
import type { GetProductoByIdResponse, UpdateProductoRequest, UpdateProductoResponse } from "../contracts";
import { createClient } from "@/supabase/server";
import { productosService, ProductosServiceError, type ProductoRow } from "../productosService";
import type { StockRow } from "../../stocks/stocksService";

function mapProducto(row: ProductoRow): Omit<ProductoDetailDTO, "stocks"> {
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

function mapStock(row: StockRow): StockDTO {
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
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies GetProductoByIdResponse, { status: 401 });
  }

  const { id } = await params;
  if (!id) return Response.json({ data: null, error: "Falta id" } satisfies GetProductoByIdResponse, { status: 400 });

  const productoRes = await productosService.getById(supabase, id);
  if (productoRes.error === ProductosServiceError.NotFound || !productoRes.data) {
    return Response.json({ data: null, error: "Producto no encontrado" } satisfies GetProductoByIdResponse, { status: 404 });
  }

  const { data: stocks } = await supabase.from("stocks").select("*").eq("productoId", id);

  return Response.json(
    { data: { ...mapProducto(productoRes.data), stocks: (stocks ?? []).map((s) => mapStock(s as StockRow)) }, error: null } satisfies GetProductoByIdResponse,
    { status: 200 }
  );
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies UpdateProductoResponse, { status: 401 });
  }

  const { id } = await params;
  const body: UpdateProductoRequest | null = await req.json().catch(() => null);
  if (!body) return Response.json({ data: null, error: "JSON inválido" } satisfies UpdateProductoResponse, { status: 400 });

  if (body.codigo !== undefined && !String(body.codigo ?? "").trim()) {
    return Response.json({ data: null, error: "Falta codigo" } satisfies UpdateProductoResponse, { status: 400 });
  }
  if (body.nombre !== undefined && !String(body.nombre ?? "").trim()) {
    return Response.json({ data: null, error: "Falta nombre" } satisfies UpdateProductoResponse, { status: 400 });
  }
  if (body.precio_unitario !== undefined && (typeof body.precio_unitario !== "number" || body.precio_unitario < 0)) {
    return Response.json({ data: null, error: "precio_unitario debe ser >= 0" } satisfies UpdateProductoResponse, { status: 400 });
  }
  if (body.costo_unitario !== undefined && (typeof body.costo_unitario !== "number" || body.costo_unitario < 0)) {
    return Response.json({ data: null, error: "costo_unitario debe ser >= 0" } satisfies UpdateProductoResponse, { status: 400 });
  }

  const patch: Partial<Omit<ProductoRow, "id" | "tenantId" | "created_at" | "updated_at">> = {};
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
    const { data: updated, error } = await productosService.updateById(supabase, id, patch);
    if (error === ProductosServiceError.NotFound || !updated) {
      return Response.json({ data: null, error: "Producto no encontrado" } satisfies UpdateProductoResponse, { status: 404 });
    }
    const { data: stocks } = await supabase.from("stocks").select("*").eq("productoId", id);

    return Response.json(
      { data: { ...mapProducto(updated), stocks: (stocks ?? []).map((s) => mapStock(s as StockRow)) }, error: null } satisfies UpdateProductoResponse,
      { status: 200 }
    );
  } catch (error: unknown) {
    logger.error("PUT /api/productos/[id] error:", error);
    return Response.json({ data: null, error: "Error actualizando producto" } satisfies UpdateProductoResponse, { status: 500 });
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
    const { error } = await productosService.deleteById(supabase, id);
    if (error === ProductosServiceError.NotFound) return Response.json({ error: "Producto no encontrado" }, { status: 404 });
    if (error) return Response.json({ error: "Error eliminando producto" }, { status: 500 });
    return Response.json({ error: null }, { status: 200 });
  } catch (error: unknown) {
    logger.error("DELETE /api/productos/[id] error:", error);
    return Response.json({ error: "Error eliminando producto" }, { status: 500 });
  }
}

