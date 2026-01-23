import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT, DELETE } from "./route";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("../stocksService", async () => {
  const actual = await vi.importActual<typeof import("../stocksService")>("../stocksService");
  return {
    ...actual,
    stocksService: {
      ...actual.stocksService,
      getById: vi.fn(),
      updateById: vi.fn(),
      deleteById: vi.fn(),
    },
  };
});

import { createClient } from "@/supabase/server";
import { stocksService, StocksServiceError } from "../stocksService";

describe("/api/stocks/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) },
    } as any);
  });

  it("GET not found devuelve 404", async () => {
    vi.mocked(stocksService.getById).mockResolvedValue({ data: null, error: StocksServiceError.NotFound });
    const req = new Request("http://localhost/api/stocks/s1");
    const res = await GET(req as any, { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(404);
  });

  it("PUT actualiza y devuelve 200", async () => {
    vi.mocked(stocksService.updateById).mockResolvedValue({
      data: {
        id: "STK-1",
        tenantId: "TEN-1",
        tallerId: "TAL-001",
        productoId: "PROD-001",
        cantidad: 11,
        stock_minimo: 2,
        stock_maximo: 20,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });

    const req = new Request("http://localhost/api/stocks/s1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cantidad: 11 }),
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: "STK-1" }) });
    expect(res.status).toBe(200);
  });

  it("DELETE elimina y devuelve 200", async () => {
    vi.mocked(stocksService.deleteById).mockResolvedValue({ error: null });
    const req = new Request("http://localhost/api/stocks/s1", { method: "DELETE" });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: "STK-1" }) });
    expect(res.status).toBe(200);
  });
});

