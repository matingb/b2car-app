import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/api/inventario/inventarioMockDb", () => {
  return {
    inventarioMockDb: {
      listStocks: vi.fn(),
      getProductoById: vi.fn(),
      getStockByTallerProducto: vi.fn(),
      getTallerNombre: vi.fn(),
      upsertStock: vi.fn(),
    },
  };
});

import { GET, POST } from "./route";
import { inventarioMockDb } from "@/app/api/inventario/inventarioMockDb";
import {
  createInventarioProductoRow,
  createInventarioStockRow,
} from "@/tests/factories";

async function postStock(input: unknown) {
  const req = new Request("http://localhost/api/stocks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const res = await POST(req);
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

describe("/api/stocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET devuelve lista (sin query params)", async () => {
    const stockRow = createInventarioStockRow({
      id: "STK-001",
      tallerId: "TAL-001",
      productoId: "PROD-001",
      cantidad: 10,
      stock_minimo: 2,
      stock_maximo: 20,
    });
    const productoRow = createInventarioProductoRow({
      id: "PROD-001",
      codigo: "C-1",
      nombre: "Producto 1",
      precio_unitario: 100,
      costo_unitario: 50,
      proveedor: "Proveedor 1",
      categorias: ["Cat"],
    });

    vi.mocked(inventarioMockDb.listStocks).mockReturnValue([stockRow]);
    vi.mocked(inventarioMockDb.getProductoById).mockReturnValue(productoRow);

    const req = new Request("http://localhost/api/stocks");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it("POST sin productoId devuelve 400", async () => {
    const { res } = await postStock({ tallerId: "T1" });
    expect(res.status).toBe(400);
  });

  it("POST upsert creado devuelve 201", async () => {
    vi.mocked(inventarioMockDb.getStockByTallerProducto).mockReturnValue(null);
    vi.mocked(inventarioMockDb.upsertStock).mockReturnValue({
      row: createInventarioStockRow({
        tallerId: "TAL-001",
        productoId: "PROD-999",
        cantidad: 10,
      }),
      created: true,
    });

    const { res } = await postStock({ tallerId: "TAL-001", productoId: "PROD-999", cantidad: 10 });

    expect(res.status).toBe(201);
    expect(inventarioMockDb.upsertStock).toHaveBeenCalledTimes(1);
  });

  it("POST cuando ya existe stock para producto+taller devuelve 409 con mensaje del backend", async () => {
    vi.mocked(inventarioMockDb.getStockByTallerProducto).mockReturnValue(
      createInventarioStockRow({ id: "STK-001", tallerId: "TAL-001", productoId: "PROD-001" })
    );
    vi.mocked(inventarioMockDb.getProductoById).mockReturnValue(
      createInventarioProductoRow({ id: "PROD-001", nombre: "Neumático 205/55 R16" })
    );
    vi.mocked(inventarioMockDb.getTallerNombre).mockReturnValue("Taller Centro");

    const { res, body } = await postStock({ tallerId: "TAL-001", productoId: "PROD-001", cantidad: 10 });

    expect(res.status).toBe(409);
    expect(body.error).toBe(`El producto "Neumático 205/55 R16" ya tiene stock definido para "Taller Centro"`);
  });
});

