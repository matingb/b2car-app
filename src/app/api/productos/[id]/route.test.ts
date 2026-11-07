import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GET, PUT, DELETE } from "./route";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/requirePermission", () => ({
  requirePermission: vi.fn().mockResolvedValue(null),
}));

vi.mock("../productosService", async () => {
  const actual = await vi.importActual<typeof import("../productosService")>("../productosService");
  return {
    ...actual,
    productosService: {
      ...actual.productosService,
      getById: vi.fn(),
      getWithStocksById: vi.fn(),
      updateById: vi.fn(),
      updateWithStocksById: vi.fn(),
      deleteById: vi.fn(),
    },
  };
});

import { createClient } from "@/supabase/server";
import { productosService } from "../productosService";
import { ServiceError } from "@/app/api/serviceError";

describe("/api/productos/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) },
    } as unknown as SupabaseClient);
  });

  it("GET not found devuelve 404", async () => {
    vi.mocked(productosService.getWithStocksById).mockResolvedValue({ data: null, error: ServiceError.NotFound });
    const req = new NextRequest("http://localhost/api/productos/p1");
    const res = await GET(req, { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(404);
  });

  it("GET devuelve producto con stocks incluyendo cantidad_reservada, pendiente y disponible", async () => {
    vi.mocked(productosService.getWithStocksById).mockResolvedValue({
      data: {
        id: "PROD-1",
        tenantId: "TEN-1",
        codigo: "C-1",
        nombre: "Aceite",
        marca: null,
        modelo: null,
        descripcion: null,
        precio_unitario: 100,
        costo_unitario: 50,
        proveedor: "YPF",
        categorias: ["Aceites"],
        show_in_stock: true,
        talleresConStock: 1,
        stocks: [
          {
            id: "STK-1",
            tenant_id: "TEN-1",
            taller_id: "TAL-1",
            producto_id: "PROD-1",
            cantidad: 10,
            cantidad_reservada: 3,
            cantidad_pendiente: 2,
            cantidad_disponible: 7,
            stock_minimo: 5,
            stock_maximo: 20,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-02T00:00:00Z",
          },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/productos/PROD-1");
    const res = await GET(req, { params: Promise.resolve({ id: "PROD-1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data?.stocks).toHaveLength(1);
    expect(body.data?.stocks[0]).toEqual({
      id: "STK-1",
      tallerId: "TAL-1",
      productoId: "PROD-1",
      cantidad: 10,
      cantidad_reservada: 3,
      cantidad_pendiente: 2,
      cantidad_disponible: 7,
      stock_minimo: 5,
      stock_maximo: 20,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    });
  });

  it("PUT actualiza y devuelve 200", async () => {
    vi.mocked(productosService.updateWithStocksById).mockResolvedValue({
      data: {
        id: "PROD-1",
        tenantId: "TEN-1",
        codigo: "C-1",
        nombre: "Nuevo",
        marca: null,
        modelo: null,
        descripcion: null,
        precio_unitario: 10,
        costo_unitario: 7,
        proveedor: "Prov",
        categorias: ["A"],
        show_in_stock: true,
        talleresConStock: 0,
        stocks: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/productos/p1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Nuevo" }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "PROD-1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data?.id).toBe("PROD-1");
    expect(body.data?.nombre).toBe("Nuevo");
  });

  it("PUT rechaza nombre vacío con 400", async () => {
    const req = new NextRequest("http://localhost/api/productos/p1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "   " }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "PROD-1" }) });
    expect(res.status).toBe(400);
  });

  it("PUT rechaza precio negativo con 400", async () => {
    const req = new NextRequest("http://localhost/api/productos/p1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ precio_unitario: -10 }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "PROD-1" }) });
    expect(res.status).toBe(400);
  });

  it("DELETE elimina y devuelve 200", async () => {
    vi.mocked(productosService.deleteById).mockResolvedValue({ error: null });
    const req = new NextRequest("http://localhost/api/productos/p1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "PROD-1" }) });
    expect(res.status).toBe(200);
  });
});

