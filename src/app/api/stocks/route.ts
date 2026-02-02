import { logger } from "@/lib/logger";
import type { ProductoDTO, StockDTO, StockItemDTO } from "@/model/dtos";
import type { GetStocksResponse, UpsertStockRequest, UpsertStockResponse } from "./contracts";
import { createClient } from "@/supabase/server";
import { stocksService, type StockItemRow, type StockRow } from "./stocksService";
import { productosService, type ProductoRow } from "../productos/productosService";
import { tenantService } from "../tenant/tenantService";
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

function mapProducto(row: ProductoJoinRow | null): ProductoDTO | null {
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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tallerId = url.searchParams.get("tallerId")?.trim() ?? "";

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies GetStocksResponse, { status: 401 });
  }

  const { data: rows, error } = tallerId
    ? await stocksService.listForTaller(supabase, tallerId)
    : await stocksService.listAll(supabase);
  if (error) {
    logger.error("Error listing stocks:", error);
    return Response.json({ data: [], error: "Error listando stocks" } satisfies GetStocksResponse, { status: 500 });
  }

  const items: StockItemDTO[] = rows.map((s: StockItemRow) => ({
    ...mapStockRow(s),
    producto: mapProducto(s.productos ?? null),
  }));

  return Response.json({ data: items, error: null } satisfies GetStocksResponse, { status: 200 });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies UpsertStockResponse, { status: 401 });
  }

  const body: UpsertStockRequest | null = await req.json().catch(() => null);
  if (!body) return Response.json({ data: null, error: "JSON inválido" } satisfies UpsertStockResponse, { status: 400 });

  if (!body.tallerId?.trim()) return Response.json({ data: null, error: "Falta tallerId" } satisfies UpsertStockResponse, { status: 400 });
  if (!body.productoId?.trim()) return Response.json({ data: null, error: "Falta productoId" } satisfies UpsertStockResponse, { status: 400 });

  const input = {
    taller_id: body.tallerId.trim(),
    producto_id: body.productoId.trim(),
    cantidad: typeof body.cantidad === "number" ? body.cantidad : 0,
    stock_minimo: typeof body.stock_minimo === "number" ? body.stock_minimo : 0,
    stock_maximo: typeof body.stock_maximo === "number" ? body.stock_maximo : 0,
  };

  try {
    const { data: existing, error: findError } = await stocksService.getByTallerProducto(
      supabase,
      input.taller_id,
      input.producto_id
    );
    if (findError) {
      logger.error("Error checking existing stock:", findError);
      return Response.json({ data: null, error: "Error validando stock existente" } satisfies UpsertStockResponse, { status: 500 });
    }
    if (existing) {
      const productoRes = await productosService.getById(supabase, input.producto_id);
      const productoNombre =
        productoRes.error === ServiceError.NotFound || !productoRes.data
          ? input.producto_id
          : productoRes.data.nombre;
      let includeTallerText = false;
      const talleresRes = await tenantService.getTalleres(supabase);
      
      if (!talleresRes.error) {
        includeTallerText = Array.isArray(talleresRes.data) && talleresRes.data.length > 1;
      }

      const message = includeTallerText
        ? `El producto "${productoNombre}" ya tiene stock definido para el taller seleccionado.`
        : `El producto "${productoNombre}" ya tiene stock definido.`;
      return Response.json({ data: null, error: message } satisfies UpsertStockResponse, { status: 409 });
    }

    const { data: created, error } = await stocksService.create(supabase, input);
    if (error || !created) {
      logger.error("Error creating stock:", error);
      return Response.json({ data: null, error: "Error guardando stock" } satisfies UpsertStockResponse, { status: 500 });
    }
    return Response.json({ data: mapStockRow(created), error: null } satisfies UpsertStockResponse, { status: 201 });
  } catch (error: unknown) {
    logger.error("POST /api/stocks error:", error);
    return Response.json({ data: null, error: "Error guardando stock" } satisfies UpsertStockResponse, { status: 500 });
  }
}

