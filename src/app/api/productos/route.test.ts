import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("./productosService", async () => {
  const actual = await vi.importActual<typeof import("./productosService")>("./productosService");
  return {
    ...actual,
    productosService: {
      ...actual.productosService,
      list: vi.fn(),
      create: vi.fn(),
    },
  };
});

import { createClient } from "@/supabase/server";
import { productosService } from "./productosService";

describe("/api/productos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) },
    } as any);
  });

  it("GET devuelve lista mapeada", async () => {
    vi.mocked(productosService.list).mockResolvedValue({
      data: [
        {
          id: "PROD-1",
          tenantId: "TEN-1",
          codigo: "C1",
          nombre: "Producto 1",
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
      ],
      error: null,
    });
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it("POST con JSON inválido devuelve 400", async () => {
    const req = new Request("http://localhost/api/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("POST exitoso devuelve 201", async () => {
    vi.mocked(productosService.create).mockResolvedValue({
      data: {
        id: "PROD-1",
        tenantId: "TEN-1",
        codigo: "C1",
        nombre: "Producto 1",
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
    const req = new Request("http://localhost/api/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo: "C1",
        nombre: "Producto 1",
        precio_unitario: 10,
        costo_unitario: 7,
        proveedor: "Prov",
        categorias: ["A"],
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data?.id).toBeTruthy();
  });
});

