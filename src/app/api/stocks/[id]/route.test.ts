import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT, DELETE } from "./route";
import { inventarioMockDb, resetInventarioMockDb } from "@/app/api/inventario/inventarioMockDb";

describe("/api/stocks/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetInventarioMockDb();
  });

  it("GET not found devuelve 404", async () => {
    const req = new Request("http://localhost/api/stocks/s1");
    const res = await GET(req as any, { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(404);
  });

  it("PUT actualiza y devuelve 200", async () => {
    const existing = inventarioMockDb.listStocks()[0]!;

    const req = new Request("http://localhost/api/stocks/s1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cantidad: 11 }),
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: existing.id }) });
    expect(res.status).toBe(200);
  });

  it("DELETE elimina y devuelve 200", async () => {
    const existing = inventarioMockDb.listStocks()[0]!;
    const req = new Request("http://localhost/api/stocks/s1", { method: "DELETE" });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: existing.id }) });
    expect(res.status).toBe(200);
  });
});

