import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";
import { inventarioMockDb, resetInventarioMockDb } from "@/app/api/inventario/inventarioMockDb";

describe("/api/stocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetInventarioMockDb();
  });

  it("GET devuelve lista (sin query params)", async () => {
    const req = new Request("http://localhost/api/stocks");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("POST sin productoId devuelve 400", async () => {
    const req = new Request("http://localhost/api/stocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tallerId: "T1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("POST upsert creado devuelve 201", async () => {
    const existingStocks = inventarioMockDb.listStocks().filter((s) => s.tallerId === "TAL-001");
    const stockedSet = new Set(existingStocks.map((s) => s.productoId));
    const prod = inventarioMockDb.listProductos().find((p) => !stockedSet.has(p.id))!;
    expect(prod).toBeTruthy();

    const req = new Request("http://localhost/api/stocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tallerId: "TAL-001", productoId: prod.id, cantidad: 10 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});

