import { logger } from "@/lib/logger";
import { inventarioMockDb } from "@/app/api/inventario/inventarioMockDb";
import type { ProductoDTO } from "@/model/dtos";
import type { CreateProductoRequest, CreateProductoResponse, GetProductosResponse } from "./contracts";
import { ProductoRow } from "./productosService";

function mapProducto(row: ProductoRow): ProductoDTO {
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

export async function GET() {
  const data = inventarioMockDb.listProductos();
  return Response.json({ data: data.map(mapProducto), error: null } satisfies GetProductosResponse, { status: 200 });
}

export async function POST(req: Request) {
  const body: CreateProductoRequest | null = await req.json().catch(() => null);
  if (!body) return Response.json({ data: null, error: "JSON inválido" } satisfies CreateProductoResponse, { status: 400 });

  if (!body.codigo?.trim()) return Response.json({ data: null, error: "Falta codigo" } satisfies CreateProductoResponse, { status: 400 });
  if (!body.nombre?.trim()) return Response.json({ data: null, error: "Falta nombre" } satisfies CreateProductoResponse, { status: 400 });
  if (typeof body.precio_unitario !== "number") return Response.json({ data: null, error: "Falta precio_unitario" } satisfies CreateProductoResponse, { status: 400 });
  if (typeof body.costo_unitario !== "number") return Response.json({ data: null, error: "Falta costo_unitario" } satisfies CreateProductoResponse, { status: 400 });

  const insertPayload = {
    codigo: body.codigo.trim(),
    nombre: body.nombre.trim(),
    marca: body.marca?.trim() ?? null,
    modelo: body.modelo?.trim() ?? null,
    descripcion: body.descripcion?.trim() ?? null,
    precio_unitario: body.precio_unitario,
    costo_unitario: body.costo_unitario,
    proveedor: body.proveedor?.trim() ?? null,
    categorias: Array.isArray(body.categorias) ? body.categorias.filter(Boolean) : [],
  };

  try {
    const created = inventarioMockDb.createProducto(insertPayload);
    return Response.json({ data: mapProducto(created), error: null } satisfies CreateProductoResponse, { status: 201 });
  } catch (error: unknown) {
    logger.error("POST /api/productos mock error:", error);
    return Response.json({ data: null, error: "Error creando producto" } satisfies CreateProductoResponse, { status: 500 });
  }
}

