import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GET, PUT, DELETE } from "./route";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("../productosService", async () => {
  const actual = await vi.importActual<typeof import("../productosService")>("../productosService");
  return {
    ...actual,
    productosService: {
      ...actual.productosService,
      getById: vi.fn(),
      updateById: vi.fn(),
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
      from: () => ({
        select: () => ({
          eq: async () => ({ data: [] }),
        }),
      }),
    } as unknown as SupabaseClient);
  });

  it("GET not found devuelve 404", async () => {
    vi.mocked(productosService.getById).mockResolvedValue({ data: null, error: ServiceError.NotFound });
    const req = new NextRequest("http://localhost/api/productos/p1");
    const res = await GET(req, { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(404);
  });

  it("PUT actualiza y devuelve 200", async () => {
    vi.mocked(productosService.updateById).mockResolvedValue({
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

