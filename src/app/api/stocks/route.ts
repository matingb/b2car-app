import { logger } from "@/lib/logger";
import { inventarioMockDb } from "@/app/api/inventario/inventarioMockDb";
import type { MockProductoRow, MockStockRow } from "@/app/api/inventario/inventarioMockDb";
import type { ProductoDTO, StockDTO, StockItemDTO } from "@/model/dtos";
import type { GetStocksResponse, UpsertStockRequest, UpsertStockResponse } from "./contracts";

function mapStockRow(row: MockStockRow): StockDTO {
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

function mapProducto(row: MockProductoRow | null): ProductoDTO | null {
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
    proveedor: row.proveedor ?? null,
    categorias: Array.isArray(row.categorias) ? row.categorias : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function GET(req: Request) {
  void req;
  const rows = inventarioMockDb.listStocks();
  const items: StockItemDTO[] = rows.map((s) => ({
    ...mapStockRow(s),
    producto: mapProducto(inventarioMockDb.getProductoById(s.productoId)),
  }));
  return Response.json({ data: items, error: null } satisfies GetStocksResponse, { status: 200 });
}

export async function POST(req: Request) {
  const body: UpsertStockRequest | null = await req.json().catch(() => null);
  if (!body) return Response.json({ data: null, error: "JSON inválido" } satisfies UpsertStockResponse, { status: 400 });

  if (!body.tallerId?.trim()) return Response.json({ data: null, error: "Falta tallerId" } satisfies UpsertStockResponse, { status: 400 });
  if (!body.productoId?.trim()) return Response.json({ data: null, error: "Falta productoId" } satisfies UpsertStockResponse, { status: 400 });

  const input = {
    tallerId: body.tallerId.trim(),
    productoId: body.productoId.trim(),
    cantidad: typeof body.cantidad === "number" ? body.cantidad : 0,
    stock_minimo: typeof body.stock_minimo === "number" ? body.stock_minimo : 0,
    stock_maximo: typeof body.stock_maximo === "number" ? body.stock_maximo : 0,
  };

  try {
    const existing = inventarioMockDb.getStockByTallerProducto(input.tallerId, input.productoId);
    if (existing) {
      const producto = inventarioMockDb.getProductoById(input.productoId);
      const tallerNombre = inventarioMockDb.getTallerNombre(input.tallerId);
      const productoNombre = producto?.nombre ?? input.productoId;
      const tallerLabel = tallerNombre ?? input.tallerId;
      const message = `El producto "${productoNombre}" ya tiene stock definido para "${tallerLabel}"`;
      return Response.json({ data: null, error: message } satisfies UpsertStockResponse, { status: 409 });
    }

    const { row } = inventarioMockDb.upsertStock(input);
    return Response.json({ data: mapStockRow(row), error: null } satisfies UpsertStockResponse, { status: 201 });
  } catch (error: unknown) {
    logger.error("POST /api/stocks mock error:", error);
    return Response.json({ data: null, error: "Error guardando stock" } satisfies UpsertStockResponse, { status: 500 });
  }
}

