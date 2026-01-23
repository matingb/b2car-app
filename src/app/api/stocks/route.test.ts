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

import { GET, POST } from "./route";
import { createClient } from "@/supabase/server";
import { stocksService } from "./stocksService";
import { productosService } from "../productos/productosService";

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
      data: [
        {
          id: "STK-001",
          tenantId: "TEN-1",
          tallerId: "TAL-001",
          productoId: "PROD-001",
          cantidad: 10,
          stock_minimo: 2,
          stock_maximo: 20,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          productos: {
            id: "PROD-001",
            tenantId: "TEN-1",
            codigo: "C-1",
            nombre: "Producto 1",
            marca: null,
            modelo: null,
            descripcion: null,
            precio_unitario: 100,
            costo_unitario: 50,
            proveedor: "Proveedor 1",
            categorias: ["Cat"],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        },
      ],
      error: null,
    });

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
    vi.mocked(stocksService.getByTallerProducto).mockResolvedValue({ data: null, error: null });
    vi.mocked(stocksService.create).mockResolvedValue({
      data: {
        id: "STK-999",
        tenantId: "TEN-1",
        tallerId: "TAL-001",
        productoId: "PROD-999",
        cantidad: 10,
        stock_minimo: 0,
        stock_maximo: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });

    const { res } = await postStock({ tallerId: "TAL-001", productoId: "PROD-999", cantidad: 10 });

    expect(res.status).toBe(201);
    expect(stocksService.create).toHaveBeenCalledTimes(1);
  });

  it("POST cuando ya existe stock para producto+taller devuelve 409 con mensaje del backend", async () => {
    vi.mocked(stocksService.getByTallerProducto).mockResolvedValue({
      data: {
        id: "STK-001",
        tenantId: "TEN-1",
        tallerId: "TAL-001",
        productoId: "PROD-001",
        cantidad: 10,
        stock_minimo: 2,
        stock_maximo: 20,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });
    vi.mocked(productosService.getById).mockResolvedValue({
      data: {
        id: "PROD-001",
        tenantId: "TEN-1",
        codigo: "C-1",
        nombre: "Neumático 205/55 R16",
        marca: null,
        modelo: null,
        descripcion: null,
        precio_unitario: 100,
        costo_unitario: 50,
        proveedor: null,
        categorias: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });

    const { res, body } = await postStock({ tallerId: "TAL-001", productoId: "PROD-001", cantidad: 10 });

    expect(res.status).toBe(409);
    expect(body.error).toBe(`El producto "Neumático 205/55 R16" ya tiene stock definido para el taller "TAL-001"`);
  });
});

