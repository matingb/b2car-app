import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("./stocksService", async () => {
  const actual = await vi.importActual<typeof import("./stocksService")>("./stocksService");
  return {
    ...actual,
    stocksService: {
      ...actual.stocksService,
      listAll: vi.fn(),
      listForTaller: vi.fn(),
      getByTallerProducto: vi.fn(),
      create: vi.fn(),
    },
  };
});

vi.mock("../productos/productosService", async () => {
  const actual = await vi.importActual<typeof import("../productos/productosService")>(
    "../productos/productosService"
  );
  return {
    ...actual,
    productosService: {
      ...actual.productosService,
      getById: vi.fn(),
    },
  };
});

vi.mock("../tenant/tenantService", async () => {
  const actual = await vi.importActual<typeof import("../tenant/tenantService")>(
    "../tenant/tenantService"
  );
  return {
    ...actual,
    tenantService: {
      ...actual.tenantService,
      getTalleres: vi.fn(),
    },
  };
});

import { GET, POST } from "./route";
import { createClient } from "@/supabase/server";
import { stocksService } from "./stocksService";
import { productosService } from "../productos/productosService";
import { tenantService } from "../tenant/tenantService";
import { createInventarioProductoRow, createStockItemRow, createStockRow } from "@/tests/factories";

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
    vi.mocked(createClient).mockResolvedValue({
      auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) },
    } as unknown as SupabaseClient);
  });

  it("GET devuelve lista (sin query params)", async () => {
    vi.mocked(stocksService.listAll).mockResolvedValue({
      data: [createStockItemRow()],
      error: null,
    });

    const req = new Request("http://localhost/api/stocks");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it("GET si se invoca con tallerId como filtro, usa listForTaller en vez de listAll", async () => {
    const tallerId = "TAL-001";
    
    vi.mocked(stocksService.listForTaller).mockResolvedValue({
      data: [createStockItemRow({ taller_id: tallerId })],
      error: null,
    });

    await GET(new Request(`http://localhost/api/stocks?tallerId=${tallerId}`));

    expect(stocksService.listForTaller).toHaveBeenCalledWith(expect.anything(), tallerId);
    expect(stocksService.listAll).toHaveBeenCalledTimes(0);
  });

  it("POST sin productoId devuelve 400", async () => {
    const { res } = await postStock({ tallerId: "T1" });
    expect(res.status).toBe(400);
  });

  it("POST upsert creado devuelve 201", async () => {
    vi.mocked(stocksService.getByTallerProducto).mockResolvedValue({ data: null, error: null });
    vi.mocked(stocksService.create).mockResolvedValue({
      data: createStockRow({
        id: "STK-999",
        producto_id: "PROD-999",
        cantidad: 10,
        stock_minimo: 0,
        stock_maximo: 0,
      }),
      error: null,
    });

    const { res } = await postStock({ tallerId: "TAL-001", productoId: "PROD-999", cantidad: 10 });

    expect(res.status).toBe(201);
    expect(stocksService.create).toHaveBeenCalledTimes(1);
  });

  it("POST cuando ya existe stock para producto+taller y el usuario tiene +1 taller devuelve 409 con mensaje incluyendo 'taller seleccionado'", async () => {
    vi.mocked(stocksService.getByTallerProducto).mockResolvedValue({
      data: createStockRow({ taller_id: "TAL-001", producto_id: "PROD-001" }),
      error: null,
    });

    vi.mocked(productosService.getById).mockResolvedValue({
      data: createInventarioProductoRow({
        id: "PROD-001",
        nombre: "Neumático 205/55 R16",
        proveedor: null,
        categorias: [],
      }),
      error: null,
    });

    vi.mocked(tenantService.getTalleres).mockResolvedValue({
      data: [
        { id: "TAL-001", nombre: "Taller 1", ubicacion: "Ubicación 1" },
        { id: "TAL-002", nombre: "Taller 2", ubicacion: "Ubicación 2" },
      ],
      error: null,
    });

    const { res, body } = await postStock({ tallerId: "TAL-001", productoId: "PROD-001", cantidad: 10 });

    expect(res.status).toBe(409);
    expect(body.error).toBe(
      `El producto "Neumático 205/55 R16" ya tiene stock definido para el taller seleccionado.`
    );
  });

  it("POST cuando ya existe stock para producto+taller devuelve 409", async () => {
    vi.mocked(stocksService.getByTallerProducto).mockResolvedValue({
      data: createStockRow({ taller_id: "TAL-001", producto_id: "PROD-001" }),
      error: null,
    });

    vi.mocked(productosService.getById).mockResolvedValue({
      data: createInventarioProductoRow({
        id: "PROD-001",
        nombre: "Neumático 205/55 R16",
        proveedor: null,
        categorias: [],
      }),
      error: null,
    });

    vi.mocked(tenantService.getTalleres).mockResolvedValue({
      data: [{ id: "TAL-001", nombre: "Taller 1", ubicacion: "Ubicación 1" }],
      error: null,
    });

    const { res, body } = await postStock({ tallerId: "TAL-001", productoId: "PROD-001", cantidad: 10 });

    expect(res.status).toBe(409);
    expect(body.error).toBe(`El producto "Neumático 205/55 R16" ya tiene stock definido.`);
  });
});

