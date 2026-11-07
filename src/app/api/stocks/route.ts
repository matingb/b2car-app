import { logger } from "@/lib/logger";
import type { StockItemDTO } from "@/model/dtos";
import type { GetStocksResponse, UpsertStockRequest, UpsertStockResponse } from "./contracts";
import { createClient } from "@/supabase/server";
import { stocksService, type StockItemRow } from "./stocksService";
import { productosService } from "../productos/productosService";
import { tenantService } from "../tenant/tallerService";
import { ServiceError } from "@/app/api/serviceError";
import { mapStockItemRow } from "./stocksMapper";

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

  const items: StockItemDTO[] = rows.map((s: StockItemRow) => mapStockItemRow(s));

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

      let message = includeTallerText
        ? `El producto "${productoNombre}" ya tiene stock definido para el taller seleccionado.`
        : `El producto "${productoNombre}" ya tiene stock definido.`;
      message +=
        " Revise si el producto ya figura en el inventario o si tiene deshabilitada la opción para mostrarse allí.";
      return Response.json({ data: null, error: message } satisfies UpsertStockResponse, { status: 409 });
    }

    const { data: created, error } = await stocksService.create(supabase, input);
    if (error || !created) {
      logger.error("Error creating stock:", error);
      return Response.json({ data: null, error: "Error guardando stock" } satisfies UpsertStockResponse, { status: 500 });
    }
    const item: StockItemDTO = mapStockItemRow(created);
    return Response.json({ data: item, error: null } satisfies UpsertStockResponse, { status: 201 });
  } catch (error: unknown) {
    logger.error("POST /api/stocks error:", error);
    return Response.json({ data: null, error: "Error guardando stock" } satisfies UpsertStockResponse, { status: 500 });
  }
}

