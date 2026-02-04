import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
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
import { stocksService } from "../stocksService";
import { ServiceError } from "@/app/api/serviceError";
import { SupabaseClient } from "@supabase/supabase-js";
import { createStockItemRow } from "@/tests/factories";

describe("/api/stocks/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) },
    } as unknown as SupabaseClient);
  });

  it("GET not found devuelve 404", async () => {
    vi.mocked(stocksService.getById).mockResolvedValue({ data: null, error: ServiceError.NotFound });
    const req = new NextRequest("http://localhost/api/stocks/s1");
    const res = await GET(req, { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(404);
  });

  it("PUT actualiza y devuelve 200", async () => {
    vi.mocked(stocksService.updateById).mockResolvedValue({
      data: createStockItemRow({
        id: "STK-1",
        taller_id: "TAL-001",
        producto_id: "PROD-001",
        cantidad: 11,
        stock_minimo: 2,
        stock_maximo: 20,
      }),
      error: null,
    });

    const req = new NextRequest("http://localhost/api/stocks/s1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cantidad: 11 }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "STK-1" }) });
    expect(res.status).toBe(200);
  });

  it("DELETE elimina y devuelve 200", async () => {
    vi.mocked(stocksService.deleteById).mockResolvedValue({ error: null });
    const req = new NextRequest("http://localhost/api/stocks/s1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "STK-1" }) });
    expect(res.status).toBe(200);
  });
});

